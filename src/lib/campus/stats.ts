/** Career-center numbers. Pure, tested. Counselors get aggregates; a student is named only when flagged AND they
 *  haven't opted out (profiles.campus_share), and then only program, counts and the reason. */
import type { Stage } from "../tracker/stages";

export type CampusStudent = { id: string; name: string | null; program: string | null; created_at: string; share: boolean };
export type CampusApp = { user_id: string; company_name: string; title: string; stage: Stage; applied_at: string | null; created_at: string; last_activity_at: string; tailored: boolean };
export type Term = { key: string; label: string; from: Date; to: Date };

const APPLIED = (a: CampusApp) => a.stage !== "saved" && a.stage !== "prepared";
const REPLIED = (a: CampusApp) => ["viewed", "oa", "interview", "offer", "rejected"].includes(a.stage);
const INTERVIEW = (a: CampusApp) => a.stage === "interview" || a.stage === "offer";
const DAY = 86_400_000;
const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : null);

/** Fall = Aug-Dec, Spring = Jan-May, Summer = Jun-Jul. */
export function termOf(d: Date): Term {
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (m >= 7) return { key: `fall-${y}`, label: `Fall ${y}`, from: new Date(Date.UTC(y, 7, 1)), to: new Date(Date.UTC(y + 1, 0, 1)) };
  if (m <= 4) return { key: `spring-${y}`, label: `Spring ${y}`, from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y, 5, 1)) };
  return { key: `summer-${y}`, label: `Summer ${y}`, from: new Date(Date.UTC(y, 5, 1)), to: new Date(Date.UTC(y, 7, 1)) };
}
export function parseTerm(key: string | undefined, now: Date): Term {
  const m = key?.match(/^(fall|spring|summer)-(\d{4})$/);
  if (!m) return termOf(now);
  const y = Number(m[2]);
  return termOf(new Date(Date.UTC(y, m[1] === "fall" ? 8 : m[1] === "spring" ? 1 : 6, 1)));
}
export function recentTerms(now: Date, n = 4): Term[] {
  const out: Term[] = []; let t = termOf(now);
  for (let i = 0; i < n; i++) { out.push(t); t = termOf(new Date(t.from.getTime() - DAY)); }
  return out;
}

export type Flag = { id: string; name: string; program: string; applied: number; interviews: number; why: string; tone: "risk" | "good" };

export function campusStats(students: CampusStudent[], allApps: CampusApp[], term: Term, now: Date) {
  const inTerm = (a: CampusApp) => { const t = Date.parse(a.applied_at ?? a.created_at); return t >= term.from.getTime() && t < term.to.getTime(); };
  const apps = allApps.filter(inTerm);
  const applied = apps.filter(APPLIED);
  const byUser = new Map<string, CampusApp[]>();
  for (const a of applied) byUser.set(a.user_id, [...(byUser.get(a.user_id) ?? []), a]);
  const active = [...byUser.keys()].length;
  const tailored = applied.filter((a) => a.tailored), untailored = applied.filter((a) => !a.tailored);

  const headline = {
    students: students.length, active, applied: applied.length,
    interviews: applied.filter(INTERVIEW).length, offers: applied.filter((a) => a.stage === "offer").length,
    interviewRate: pct(applied.filter(INTERVIEW).length, applied.length),
    tailoredRate: tailored.length >= 5 ? pct(tailored.filter(INTERVIEW).length, tailored.length) : null,
    untailoredRate: untailored.length >= 5 ? pct(untailored.filter(INTERVIEW).length, untailored.length) : null,
  };

  const programs = new Map<string, { students: Set<string>; apps: number; interviews: number }>();
  const programOf = new Map(students.map((s) => [s.id, s.program?.trim() || "Undeclared"]));
  for (const s of students) { const k = programOf.get(s.id)!; if (!programs.has(k)) programs.set(k, { students: new Set(), apps: 0, interviews: 0 }); programs.get(k)!.students.add(s.id); }
  for (const a of applied) { const p = programs.get(programOf.get(a.user_id) ?? "Undeclared"); if (p) { p.apps++; if (INTERVIEW(a)) p.interviews++; } }
  const byProgram = [...programs.entries()].map(([name, p]) => ({ name, students: p.students.size, apps: p.apps, rate: pct(p.interviews, p.apps) })).sort((a, b) => b.apps - a.apps);

  const emp = new Map<string, { interviews: number; offers: number; apps: number; roles: Set<string> }>();
  for (const a of applied) { const e = emp.get(a.company_name) ?? { interviews: 0, offers: 0, apps: 0, roles: new Set<string>() }; e.apps++; if (INTERVIEW(a)) { e.interviews++; e.roles.add(a.title); } if (a.stage === "offer") e.offers++; emp.set(a.company_name, e); }
  const employers = [...emp.entries()].filter(([, e]) => e.interviews > 0).map(([name, e]) => ({ name, interviews: e.interviews, offers: e.offers, apps: e.apps, roles: [...e.roles].slice(0, 2) })).sort((a, b) => b.offers - a.offers || b.interviews - a.interviews).slice(0, 8);

  // Where students get stuck: how many applications reached each step.
  const reached = (stages: Stage[]) => applied.filter((a) => stages.includes(a.stage) || (stages.includes("oa") && INTERVIEW(a))).length;
  const oaRejected = allApps.filter((a) => inTerm(a) && a.stage === "rejected").length; // rejections at any step
  const funnel = [
    { stage: "Applied", n: applied.length },
    { stage: "Heard back", n: applied.filter(REPLIED).length },
    { stage: "Online assessment", n: reached(["oa", "interview", "offer"]) },
    { stage: "Interview", n: applied.filter(INTERVIEW).length },
    { stage: "Offer", n: headline.offers },
  ];
  let drop = { from: "", to: "", lost: 0 };
  for (let i = 1; i < funnel.length; i++) { const lost = funnel[i - 1]!.n ? 1 - funnel[i]!.n / funnel[i - 1]!.n : 0; if (funnel[i - 1]!.n >= 5 && lost > drop.lost) drop = { from: funnel[i - 1]!.stage, to: funnel[i]!.stage, lost }; }

  // Flags: the students a counselor can help this week.
  const flags: Flag[] = [];
  for (const s of students) {
    if (!s.share) continue;
    const mine = allApps.filter((a) => a.user_id === s.id);
    const ap = mine.filter(APPLIED), iv = ap.filter(INTERVIEW).length;
    const base = { id: s.id, name: s.name ?? "Student", program: programOf.get(s.id)!, applied: ap.length, interviews: iv };
    const age = (now.getTime() - Date.parse(s.created_at)) / DAY;
    const lastApply = Math.max(0, ...ap.map((a) => Date.parse(a.applied_at ?? a.created_at)));
    if (age >= 14 && ap.length === 0) flags.push({ ...base, why: `Joined ${Math.floor(age)} days ago, no applications yet`, tone: "risk" });
    else if (ap.length >= 15 && ap.filter(REPLIED).length === 0) flags.push({ ...base, why: `${ap.length} applications, no replies. Resume or targeting`, tone: "risk" });
    else if (mine.filter((a) => a.stage === "rejected").length >= 3 && ap.filter((a) => a.stage === "oa").length + mine.filter((a) => a.stage === "rejected").length >= 4 && iv === 0) flags.push({ ...base, why: "Stalling after online assessments", tone: "risk" });
    else if (ap.length > 0 && lastApply && (now.getTime() - lastApply) / DAY >= 21 && iv === 0) flags.push({ ...base, why: `No new applications in ${Math.floor((now.getTime() - lastApply) / DAY)} days`, tone: "risk" });
    else if (mine.some((a) => a.stage === "interview")) flags.push({ ...base, why: "Has an interview coming: offer a mock", tone: "good" });
  }
  flags.sort((a, b) => (a.tone === b.tone ? b.applied - a.applied : a.tone === "risk" ? -1 : 1));

  return { headline, byProgram, employers, funnel, drop: drop.lost ? drop : null, oaRejected, flags };
}

/** Program-level CSV. No names, ever. */
export function placementCsv(stats: ReturnType<typeof campusStats>, term: Term, campus: string): string {
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows: unknown[][] = [
    ["Campus", campus], ["Term", term.label], [],
    ["Students", "Active", "Applications", "Interviews", "Offers", "Interview rate %"],
    [stats.headline.students, stats.headline.active, stats.headline.applied, stats.headline.interviews, stats.headline.offers, stats.headline.interviewRate ?? ""], [],
    ["Program", "Students", "Applications", "Interview rate %"], ...stats.byProgram.map((p) => [p.name, p.students, p.apps, p.rate ?? ""]), [],
    ["Employer", "Applications", "Interviews", "Offers"], ...stats.employers.map((e) => [e.name, e.apps, e.interviews, e.offers]),
  ];
  return rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}
