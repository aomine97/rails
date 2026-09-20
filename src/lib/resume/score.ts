import type { CanonicalProfile } from "../schemas/profile";

export interface ResumeScore {
  total: number;
  bars: { key: string; label: string; score: number; why: string }[];
  fixes: { points: number; title: string; detail: string; where?: string }[];
}

const VERB = /^(built|led|designed|developed|created|implemented|automated|reduced|increased|improved|launched|shipped|deployed|migrated|resolved|managed|wrote|analyzed|configured|maintained|tested|debugged|optimized|delivered|supported|trained|installed|monitored|integrated|owned|drove|cut|grew|scaled|architected|researched|presented|coordinated|handled|processed|imaged|closed|set up|ran)\b/i;
const NUMBER = /\d/;
const WEAK = /\b(responsible for|duties included|helped|assisted with|worked on|various|etc\.?|hard[- ]working|team player|detail[- ]oriented|passionate|synerg)/i;

/** Deterministic, explainable, instant. The number is about the resume as a document, not fit to any job. */
export function scoreResume(p: CanonicalProfile): ResumeScore {
  const bullets = p.experience.flatMap((e) => e.bullets.filter(Boolean));
  const fixes: ResumeScore["fixes"] = [];

  // 1. Impact: numbers in bullets
  const withNum = bullets.filter((b) => NUMBER.test(b)).length;
  const impact = bullets.length ? Math.round(100 * Math.min(1, (withNum / bullets.length) / 0.6)) : 0;
  if (bullets.length && withNum / bullets.length < 0.6) {
    const ex = bullets.find((b) => !NUMBER.test(b));
    fixes.push({ points: Math.min(12, Math.round((0.6 - withNum / bullets.length) * 20)), title: `Put a number in ${bullets.length - withNum} more bullet${bullets.length - withNum === 1 ? "" : "s"}`, detail: "Tickets closed, users, uptime, dollars, hours saved, records processed. A bullet with a number gets read; one without gets skimmed.", where: ex });
  }

  // 2. Action verbs
  const withVerb = bullets.filter((b) => VERB.test(b.trim())).length;
  const verbs = bullets.length ? Math.round(100 * Math.min(1, (withVerb / bullets.length) / 0.85)) : 0;
  if (bullets.length && withVerb / bullets.length < 0.85) {
    const ex = bullets.find((b) => !VERB.test(b.trim()));
    fixes.push({ points: 6, title: "Start every bullet with a verb", detail: "Built, cut, automated, resolved. Drop 'responsible for' and 'helped with'.", where: ex });
  }

  // 3. Weak phrases
  const weakHits = bullets.filter((b) => WEAK.test(b)).length + (p.headline && WEAK.test(p.headline) ? 1 : 0);
  const clarity = Math.max(0, 100 - weakHits * 20);
  if (weakHits) fixes.push({ points: Math.min(8, weakHits * 3), title: `Cut ${weakHits} filler phrase${weakHits === 1 ? "" : "s"}`, detail: "'Responsible for', 'team player', 'passionate' and 'etc.' say nothing. Replace each with what you did.", where: bullets.find((b) => WEAK.test(b)) });

  // 4. Skills coverage: count and evidence
  const skillCount = p.skills.length;
  const withEvidence = p.skills.filter((s) => s.evidence || p.experience.some((e) => e.skills.includes(s.key))).length;
  const skills = Math.round(Math.min(100, (Math.min(skillCount, 15) / 15) * 60 + (skillCount ? withEvidence / skillCount : 0) * 40));
  if (skillCount < 10) fixes.push({ points: 8, title: `List more skills (you have ${skillCount})`, detail: "Languages, frameworks, cloud, tools, OS. Postings are matched on these; every missing one is a job you don't show up for." });
  if (skillCount && withEvidence / skillCount < 0.5) fixes.push({ points: 5, title: "Back skills with a bullet", detail: "A skill nobody can see you using reads as a keyword. Mention it in the bullet where you used it." });

  // 5. Experience depth
  const roles = p.experience.filter((e) => e.kind === "job" || e.kind === "internship").length;
  const projects = p.experience.filter((e) => e.kind === "project" || e.kind === "research").length;
  const thin = p.experience.filter((e) => e.bullets.filter(Boolean).length < 2);
  const depth = Math.round(Math.min(100, roles * 25 + projects * 20 + (p.certifications.length ? 15 : 0)));
  if (projects === 0) fixes.push({ points: 10, title: "Add one project", detail: "One shipped project with a repo link does more for a student resume than a second retail job. Title, what it does, what you used, one number." });
  if (thin.length) fixes.push({ points: 5, title: `Give ${thin.map((e) => e.title).join(", ")} at least 2 bullets`, detail: "An entry with one line looks like filler. Two or three specific bullets, or drop it." });

  // 6. Completeness
  const missing: string[] = [];
  if (!p.phone) missing.push("phone");
  if (!p.links.linkedin) missing.push("LinkedIn");
  if (!p.links.github && !p.links.portfolio) missing.push("GitHub or portfolio");
  if (!p.headline) missing.push("headline");
  if (!p.education.length) missing.push("education");
  if (!p.targetRoles.length) missing.push("target roles");
  const completeness = Math.max(0, 100 - missing.length * 17);
  if (missing.length) fixes.push({ points: Math.min(8, missing.length * 3), title: `Add ${missing.join(", ")}`, detail: "Recruiters and ATS filters look for these first. Two minutes." });

  const bars = [
    { key: "impact", label: "Numbers in bullets", score: impact, why: `${withNum} of ${bullets.length} bullets have a number` },
    { key: "verbs", label: "Action verbs", score: verbs, why: `${withVerb} of ${bullets.length} bullets start with one` },
    { key: "clarity", label: "No filler", score: clarity, why: weakHits ? `${weakHits} filler phrase${weakHits === 1 ? "" : "s"}` : "clean" },
    { key: "skills", label: "Skills coverage", score: skills, why: `${skillCount} skills, ${withEvidence} backed by a bullet` },
    { key: "depth", label: "Experience depth", score: depth, why: `${roles} role${roles === 1 ? "" : "s"}, ${projects} project${projects === 1 ? "" : "s"}${p.certifications.length ? `, ${p.certifications.length} cert${p.certifications.length === 1 ? "" : "s"}` : ""}` },
    { key: "complete", label: "Complete", score: completeness, why: missing.length ? `missing ${missing.join(", ")}` : "all the basics" },
  ];
  const weights: Record<string, number> = { impact: 0.22, verbs: 0.12, clarity: 0.12, skills: 0.2, depth: 0.22, complete: 0.12 };
  const total = Math.round(bars.reduce((a, b) => a + b.score * weights[b.key], 0));
  fixes.sort((a, b) => b.points - a.points);
  return { total, bars, fixes: fixes.slice(0, 6) };
}
