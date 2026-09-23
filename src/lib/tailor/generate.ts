import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "../ai/usage";
import { bullet, title as titleCase, paragraph } from "../text/punctuate";
import { z } from "zod";
import type { CanonicalProfile } from "../schemas/profile";
import type { JobTags } from "../jobs/tags";

/** Model output. Every new bullet carries `from`: the original bullet it rewrites, or the profile skill/fact it draws on. */
const Out = z.object({
  headline: z.string().catch(""),
  summary: z.string().catch(""),
  skillsOrder: z.array(z.string()).catch([]),
  experience: z.array(z.object({
    id: z.string(),
    bullets: z.array(z.object({ text: z.string(), from: z.string().catch("") })).catch([]),
  })).catch([]),
  gapPlan: z.array(z.object({
    gap: z.string(),
    kind: z.enum(["add_if_you_have_it", "cover_in_letter", "quick_project", "course_or_cert", "cannot_fix_now"]).catch("cover_in_letter"),
    advice: z.string().catch(""),
  })).catch([]),
});
export type TailorOut = z.infer<typeof Out>;

export interface TailoredBullet { text: string; from: string; kind: "rewrite" | "skill" | "dropped" }
export interface Tailored {
  headline: string; summary: string; skillsOrder: string[];
  experience: { id: string; title: string; org: string; before: string[]; after: TailoredBullet[] }[];
  gapPlan: TailorOut["gapPlan"];
  coverage: { before: number; after: number; total: number; hitsBefore: string[]; hitsAfter: string[] };
  text: string; // plain-text resume for copy / PDF
}

export const TAILOR_SYSTEM = `You rewrite a candidate's resume bullets toward one job posting. Hard rules:
- You may only use facts in the PROFILE: its bullets, skills, education, certifications. Never add a tool, number, employer, title, or outcome that is not there. If a bullet has no number, do not invent one.
- Each output bullet must set "from" to the exact original bullet it rewrites, or "skill: <name>" when it surfaces a skill listed on the profile that the original bullets did not mention.
- Reorder and reword to lead with what the posting cares about. Use the posting's own terms where the profile supports them. Keep bullets under 25 words, start with a verb, no first person.
- Keep every experience entry; you may drop weak bullets (omit them) but never merge two entries.
- skillsOrder: the profile's skill names, most relevant to this posting first. Only names that exist on the profile.
- gapPlan: for each skill the posting wants that the profile lacks, one item: kind = add_if_you_have_it (common tool they may simply not have listed), cover_in_letter (soft or adjacent), quick_project (learnable in a weekend and worth a repo), course_or_cert (needs weeks), cannot_fix_now (clearance, citizenship, degree). advice = one sentence, specific.
Return only JSON.`;

export async function generateTailored(profile: CanonicalProfile, tags: JobTags, job: { title: string; company: string; description: string }, client = new Anthropic()): Promise<TailorOut> {
  const compact = {
    headline: profile.headline, targetRoles: profile.targetRoles,
    skills: profile.skills.map((s) => s.name),
    experience: profile.experience.map((e) => ({ id: e.id, title: e.title, org: e.org, kind: e.kind, bullets: e.bullets })),
    education: profile.education, certifications: profile.certifications.map((c) => c.name),
  };
  const res = await client.messages.create({
    model: process.env.TAILOR_MODEL ?? "claude-sonnet-4-5",
    max_tokens: 4000, system: TAILOR_SYSTEM,
    messages: [{ role: "user", content: `PROFILE:\n${JSON.stringify(compact)}\n\nPOSTING: ${job.title} at ${job.company}\nRequired skills: ${tags.requiredSkills.join(", ")}\nPreferred: ${tags.preferredSkills.join(", ")}\nRequirements: ${tags.requirements.map((r) => r.text).join(" | ")}\n\n${job.description.slice(0, 8000)}\n\nReturn JSON: {headline, summary, skillsOrder, experience:[{id, bullets:[{text, from}]}], gapPlan:[{gap, kind, advice}]}` }],
  });
  recordUsage("tailor", res.model, res.usage);
  const raw = res.content.find((c) => c.type === "text")?.text ?? "";
  return Out.parse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Enforce the rules in code: a bullet survives only if `from` is a real original bullet or a real profile skill. */
export function validateTailored(profile: CanonicalProfile, tags: JobTags, out: TailorOut): Tailored {
  const skillNames = new Map(profile.skills.map((s) => [norm(s.name), s.name]));
  const experience = profile.experience.map((e) => {
    const gen = out.experience.find((g) => g.id === e.id);
    const originals = e.bullets.map(norm);
    const after: TailoredBullet[] = [];
    for (const b of gen?.bullets ?? []) {
      const f = b.from.trim();
      const m = f.match(/^skill:\s*(.+)$/i);
      if (m) { const name = skillNames.get(norm(m[1])); if (name) after.push({ text: bullet(b.text), from: name, kind: "skill" }); continue; }
      const idx = originals.findIndex((o) => o === norm(f) || (o.length > 20 && (o.includes(norm(f).slice(0, 40)) || norm(f).includes(o.slice(0, 40)))));
      if (idx >= 0) after.push({ text: bullet(b.text), from: e.bullets[idx], kind: "rewrite" });
      // else: unverifiable provenance -> dropped silently
    }
    return { id: e.id, title: e.title, org: e.org, before: e.bullets, after: after.length ? after : e.bullets.map((t) => ({ text: bullet(t), from: t, kind: "rewrite" as const })) };
  });
  const skillsOrder = out.skillsOrder.map((n) => skillNames.get(norm(n))).filter((x): x is string => !!x);
  const rest = profile.skills.map((s) => s.name).filter((n) => !skillsOrder.includes(n));
  const allSkills = [...skillsOrder, ...rest];

  const beforeText = [profile.headline ?? "", ...profile.experience.flatMap((e) => e.bullets), ...profile.skills.map((s) => s.name)].join("\n");
  const text = [profile.name, titleCase(out.headline || profile.headline || ""), "", paragraph(out.summary), "", "SKILLS", allSkills.join(" · "), "",
    ...experience.flatMap((e) => ["EXPERIENCE", `${e.title}, ${e.org}`, ...e.after.map((b) => `• ${b.text}`), ""]),
    "EDUCATION", ...profile.education.map((ed) => `${ed.degree} ${ed.field}, ${ed.school}${ed.gradYear ? ` (${ed.gradYear})` : ""}`),
    ...(profile.certifications.length ? ["", "CERTIFICATIONS", profile.certifications.map((c) => c.name).join(" · ")] : []),
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();

  const wanted = [...tags.requiredSkills.map((k) => ({ k, w: 1 })), ...tags.preferredSkills.map((k) => ({ k, w: 0.5 }))];
  const has = (t: string, k: string) => { const nt = norm(t); const nk = norm(k.replace(/-/g, " ")); return nt.includes(nk) || nt.includes(k.toLowerCase()); };
  const hitsBefore = wanted.filter((w) => has(beforeText, w.k)).map((w) => w.k);
  const hitsAfter = wanted.filter((w) => has(text, w.k)).map((w) => w.k);
  const total = wanted.reduce((a, w) => a + w.w, 0) || 1;
  const cov = (hits: string[]) => Math.round(100 * wanted.filter((w) => hits.includes(w.k)).reduce((a, w) => a + w.w, 0) / total);
  return { headline: out.headline || profile.headline || "", summary: out.summary, skillsOrder: allSkills, experience, gapPlan: out.gapPlan, coverage: { before: cov(hitsBefore), after: cov(hitsAfter), total: wanted.length, hitsBefore, hitsAfter }, text };
}
