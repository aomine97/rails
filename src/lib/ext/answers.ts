import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { CanonicalProfile } from "../schemas/profile";
import { fillFields } from "./fields";

/** A form question the rule-based filler could not place. Options are verbatim from the page when it has a list. */
export const Question = z.object({ id: z.string(), label: z.string().max(300), kind: z.string(), options: z.array(z.string().max(200)).max(80).optional(), required: z.boolean().optional() });
export type Question = z.infer<typeof Question>;
export type Answer = { id: string; value: string | string[] | null; why: string };

const Out = z.object({ answers: z.array(z.object({ id: z.string(), value: z.union([z.string(), z.array(z.string()), z.null()]), why: z.string().catch("") })) });

/** Never answered by the model: demographics, referral source, pay, free-text essays. The panel handles those with the user. */
export const NEVER = /pronoun|gender|hispanic|latino|\brace\b|ethnicit|veteran|disabilit|self-identif|sexual orientation|how did you hear|referr|salary|compensation|\bpay\b|desired rate|password|ssn|social security|date of birth|birth ?date/i;

export const ANSWERS_SYSTEM = `You fill job-application questions for a candidate from their profile. Rules:
- Use ONLY the profile. Never invent experience, employers, dates, visas, degrees or numbers. If the profile does not settle a question, value is null and why says what is missing.
- When a question has options, value must be copied exactly from the options list (or a list of them for multi-select). Never write an option that is not listed.
- Yes/no questions about experience: "Yes" only when the profile's experience/projects/skills show it plainly; otherwise "No" when the profile is complete enough to say so (e.g. a student with listed jobs and none at a trading firm -> "No"), else null.
- Work authorization: us_citizen and permanent_resident -> authorized Yes, sponsorship No. visa_needs_sponsorship -> authorized Yes (if the question is "now"), sponsorship Yes. visa_no_sponsorship -> authorized Yes, sponsorship No. unknown -> null.
- Dates: graduation is May of gradYear unless the profile says otherwise. Start dates: earliestStart, else "Immediately" style options when present.
- Location questions: use the address / locations. Relocation and remote: from constraints (remoteOk, locations); "Yes" to relocate only if locations include more than one metro or the profile says so; else null.
- "Why this company / why this role / what interests you" and similar short essays: write 40-80 plain words in first person from the profile's real experience, skills and target roles plus the posting's title and company. No flattery, no invented facts, no "passionate". Longer essays (specific projects, situational questions) that the profile cannot answer: null.
- Short factual text (years of experience with X, a URL, a school name, a number) may be written from the profile.
- Keep why under 12 words. Return only JSON: {"answers":[{"id","value","why"}]}.`;

export function compactProfile(p: CanonicalProfile) {
  const f = fillFields(p);
  return {
    name: p.name, email: p.email, phone: p.phone, address: p.address, links: p.links, headline: p.headline, targetRoles: p.targetRoles,
    skills: p.skills.map((s) => `${s.name} (${s.level})`),
    experience: p.experience.map((e) => ({ title: e.title, org: e.org, kind: e.kind, start: e.start, end: e.end, bullets: e.bullets.slice(0, 3) })),
    education: p.education.map((e) => ({ school: e.school, degree: e.degree, field: e.field, startYear: e.startYear, gradYear: e.gradYear, gpa: e.gpa })),
    certifications: p.certifications.map((c) => c.name),
    constraints: p.constraints,
    derived: { workAuthorized: f.workAuthorized, needsSponsorship: f.needsSponsorship, gradDate: f.gradDate, disciplines: f.disciplines, stateName: f.stateName },
  };
}

export async function answerQuestions(profile: CanonicalProfile, questions: Question[], context: { url?: string; company?: string; title?: string }, client = new Anthropic()): Promise<Answer[]> {
  const ask = questions.filter((q) => !NEVER.test(q.label)).slice(0, 40);
  const skipped: Answer[] = questions.filter((q) => NEVER.test(q.label)).map((q) => ({ id: q.id, value: null, why: "Yours to answer" }));
  if (!ask.length) return skipped;
  const res = await client.messages.create({
    model: process.env.ANSWERS_MODEL ?? process.env.TAGGER_MODEL ?? "claude-haiku-4-5", max_tokens: 2000, system: ANSWERS_SYSTEM,
    messages: [{ role: "user", content: `PROFILE:\n${JSON.stringify(compactProfile(profile))}\n\nAPPLICATION: ${context.title ?? ""} at ${context.company ?? ""} (${context.url ?? ""})\n\nQUESTIONS:\n${JSON.stringify(ask)}` }],
  });
  const raw = res.content.find((c) => c.type === "text")?.text ?? "";
  const parsed = Out.safeParse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
  if (!parsed.success) return skipped;
  const byId = new Map(ask.map((q) => [q.id, q]));
  const out: Answer[] = parsed.data.answers.filter((a) => byId.has(a.id)).map((a) => {
    const q = byId.get(a.id)!;
    if (a.value != null && q.options?.length) {
      // enforce verbatim options; drop anything the model made up
      const pick = (v: string) => q.options!.find((o) => o === v) ?? q.options!.find((o) => o.toLowerCase() === v.toLowerCase()) ?? q.options!.find((o) => o.toLowerCase().startsWith(v.toLowerCase())) ?? null;
      const vals = (Array.isArray(a.value) ? a.value : [a.value]).map(pick).filter((x): x is string => !!x);
      return { id: a.id, value: vals.length ? (Array.isArray(a.value) ? vals : vals[0]!) : null, why: vals.length ? a.why : "No matching option" };
    }
    return { id: a.id, value: a.value, why: a.why };
  });
  for (const q of ask) if (!out.some((o) => o.id === q.id)) out.push({ id: q.id, value: null, why: "Not in your profile" });
  return [...out, ...skipped];
}
