import type { CanonicalProfile } from "../schemas/profile";
import { skillKey } from "../schemas/profile";
import type { JobTags } from "../jobs/tags";

export type Band = "strong" | "good" | "stretch";
export const bandOf = (fit: number): Band => (fit >= 85 ? "strong" : fit >= 70 ? "good" : "stretch");
/** UI colors from the mockups. */
export const BAND_COLOR: Record<Band, string> = { strong: "#16A34A", good: "#D97706", stretch: "#DC2626" };

export interface RequirementCheck { text: string; required: boolean; status: "met" | "partial" | "missing"; evidence: string | null }

export interface Score {
  fit: number;               // 0-100
  band: Band;
  sub: { experience: number; skills: number; field: number };
  hardBlocks: string[];      // reasons the job is excluded outright (shown, not hidden)
  requirements: RequirementCheck[];
  matchedSkills: string[];
  missingRequired: string[];
  missingPreferred: string[];
}

const FIELD_HINTS: Record<JobTags["field"], string[]> = {
  software: ["software", "engineer", "developer", "swe", "programming", "full stack", "backend", "frontend"],
  data: ["data", "analyst", "analytics", "sql", "tableau", "powerbi", "machine learning", "ml"],
  cloud: ["cloud", "aws", "azure", "gcp", "devops", "infrastructure", "kubernetes", "terraform"],
  it_support: ["help desk", "it support", "desktop", "service desk", "technician", "networking", "systems administrator"],
  cyber: ["security", "cyber", "soc", "security+", "incident", "vulnerability", "siem"],
  product: ["product", "pm", "roadmap", "ux"],
  other: [],
};

function monthsOf(e: CanonicalProfile["experience"][number], now = new Date()): number {
  if (!e.start) return 0;
  const [sy, sm] = e.start.split("-").map(Number);
  const end = e.end ? e.end.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  return Math.max(0, (end[0] - sy) * 12 + (end[1] - sm));
}

function findEvidence(p: CanonicalProfile, keys: string[]): string | null {
  const set = new Set(keys);
  const s = p.skills.find((k) => set.has(k.key));
  if (s) return s.evidence ?? `${s.name} (listed skill)`;
  for (const e of p.experience) {
    if (e.skills.some((k) => set.has(k))) return `${e.title} at ${e.org}`;
    const b = e.bullets.find((line) => keys.some((k) => line.toLowerCase().includes(k.replace(/-/g, " "))));
    if (b) return b;
  }
  const c = p.certifications.find((c) => set.has(c.key));
  if (c) return c.name;
  const edu = p.education.find((ed) => ed.coursework.some((cw) => keys.some((k) => skillKey(cw) === k)));
  if (edu) return `Coursework at ${edu.school}`;
  return null;
}

/** Pure function: profile + tags -> score. No I/O, fully testable. */
export function scoreJob(p: CanonicalProfile, t: JobTags, job: { title: string; location: string | null }): Score {
  const hardBlocks: string[] = [];
  const c = p.constraints;

  // Hard blocks (shown as red reasons, never silently hidden)
  if (t.usCitizenRequired && c.workAuthorization !== "us_citizen") hardBlocks.push("US citizenship required");
  if (t.sponsorship === "no" && c.workAuthorization === "visa_needs_sponsorship") hardBlocks.push("No visa sponsorship");
  const clearanceRank = { none: 0, eligible: 0, public_trust: 1, secret: 2, top_secret: 3, unknown: 0 } as const;
  if (clearanceRank[t.clearanceRequired] > clearanceRank[c.clearance] && t.clearanceRequired !== "eligible") hardBlocks.push(`Active ${t.clearanceRequired.replace("_", " ")} clearance required`);
  if (t.remote === "onsite" && !c.remoteOk && c.locations.length && job.location && !c.locations.some((l) => job.location!.toLowerCase().includes(l.split(",")[0].toLowerCase()))) hardBlocks.push("On-site outside your locations");
  if (t.payMaxHourly != null && c.minPayHourly != null && t.payMaxHourly < c.minPayHourly) hardBlocks.push(`Pays under your $${c.minPayHourly}/hr floor`);

  // Skills
  const have = new Set(p.skills.map((s) => s.key));
  for (const e of p.experience) e.skills.forEach((k) => have.add(k));
  p.certifications.forEach((cert) => have.add(cert.key));
  const req = t.requiredSkills.map(skillKey), pref = t.preferredSkills.map(skillKey);
  const reqHit = req.filter((k) => have.has(k)), prefHit = pref.filter((k) => have.has(k));
  const skills = req.length === 0 && pref.length === 0 ? 75
    : Math.round(100 * ((reqHit.length * 1.0 + prefHit.length * 0.5) / Math.max(1, req.length * 1.0 + pref.length * 0.5)));

  // Experience: months of relevant experience vs years asked, plus level fit
  const relevantMonths = p.experience.filter((e) => e.kind !== "club" && e.kind !== "volunteer").reduce((a, e) => a + monthsOf(e), 0);
  const askedMonths = (t.yearsMin ?? 0) * 12;
  let experience = askedMonths === 0 ? 85 : Math.min(100, Math.round(100 * relevantMonths / askedMonths));
  if (t.level === "internship" || t.level === "new_grad") experience = Math.max(experience, 80);
  if ((t.level === "mid" || t.level === "senior") && relevantMonths < 36) experience = Math.min(experience, 45);
  if (p.experience.some((e) => e.kind === "project" || e.kind === "internship")) experience = Math.min(100, experience + 8);

  // Field: does the profile's headline/target roles/skills point at this job's field?
  const hay = [p.headline ?? "", ...p.targetRoles, ...p.skills.map((s) => s.name), ...p.education.map((e) => e.field), job.title].join(" ").toLowerCase();
  const hints = FIELD_HINTS[t.field];
  const fieldHits = hints.filter((h) => hay.includes(h)).length;
  let field = hints.length ? Math.min(100, 55 + fieldHits * 12) : 70;
  const degreeRank = { none: 0, associate: 1, bachelor: 2, master: 3, phd: 4, unknown: 0 } as const;
  const bestDegree = Math.max(0, ...p.education.map((e) => /phd|doctor/i.test(e.degree) ? 4 : /^m/i.test(e.degree) ? 3 : /^b/i.test(e.degree) ? 2 : /^a|associate/i.test(e.degree) ? 1 : 0));
  if (degreeRank[t.minDegree] > bestDegree) field = Math.min(field, 62); // shown as amber, not a block: many postings say "or equivalent"

  const fit = hardBlocks.length ? Math.min(45, Math.round(0.45 * skills + 0.3 * experience + 0.25 * field)) : Math.round(0.45 * skills + 0.3 * experience + 0.25 * field);

  const requirements: RequirementCheck[] = t.requirements.map((r) => {
    const keys = [...req, ...pref].filter((k) => r.text.toLowerCase().includes(k.replace(/-/g, " ")) || r.text.toLowerCase().includes(k));
    const ev = keys.length ? findEvidence(p, keys) : null;
    const status: RequirementCheck["status"] = keys.length === 0 ? "partial" : ev ? "met" : "missing";
    return { text: r.text, required: r.required, status, evidence: ev };
  });

  return {
    fit, band: bandOf(fit), sub: { experience, skills, field }, hardBlocks, requirements,
    matchedSkills: [...reqHit, ...prefHit], missingRequired: req.filter((k) => !have.has(k)), missingPreferred: pref.filter((k) => !have.has(k)),
  };
}
