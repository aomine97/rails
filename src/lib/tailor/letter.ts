import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { CanonicalProfile } from "../schemas/profile";
import type { JobTags } from "../jobs/tags";

const Out = z.object({
  letter: z.string(),
  /** each paragraph's sources: profile facts it used, so the UI can show "From your profile: …" */
  sources: z.array(z.string()).catch([]),
});
export type Letter = z.infer<typeof Out>;

export const LETTER_SYSTEM = `Write a cover letter a real student or early-career engineer would send. Rules:
- 3 short paragraphs, under 220 words total. Plain, direct, no "I am writing to express", no "passionate", no "leverage", no exclamation marks.
- Paragraph 1: the specific role and the one thing from the posting that matches the candidate best, with the profile fact that proves it.
- Paragraph 2: one or two concrete things from the profile (a bullet with a number if there is one; a project; a cert). Never invent facts, numbers, tools or employers.
- Paragraph 3: a gap the posting names that the profile lacks, handled honestly in one sentence (learning it / adjacent experience), then a plain close.
- Use the company's name once. No placeholders like [Company]. Sign with the candidate's name.
- sources: list the exact profile facts used (bullet text, skill names, cert names). Return only JSON: {letter, sources}.`;

export async function generateLetter(profile: CanonicalProfile, tags: JobTags, job: { title: string; company: string; description: string }, client = new Anthropic()): Promise<Letter> {
  const compact = { name: profile.name, headline: profile.headline, skills: profile.skills.map((s) => s.name), experience: profile.experience.map((e) => ({ title: e.title, org: e.org, kind: e.kind, bullets: e.bullets })), education: profile.education.map((e) => `${e.degree} ${e.field}, ${e.school}${e.gradYear ? ` ${e.gradYear}` : ""}`), certifications: profile.certifications.map((c) => c.name) };
  const res = await client.messages.create({
    model: process.env.TAILOR_MODEL ?? "claude-sonnet-4-5", max_tokens: 1200, system: LETTER_SYSTEM,
    messages: [{ role: "user", content: `PROFILE:\n${JSON.stringify(compact)}\n\nPOSTING: ${job.title} at ${job.company}\nWants: ${tags.requiredSkills.join(", ")}${tags.preferredSkills.length ? ` (preferred: ${tags.preferredSkills.join(", ")})` : ""}\nSummary: ${tags.summary}\n\n${job.description.slice(0, 6000)}` }],
  });
  const raw = res.content.find((c) => c.type === "text")?.text ?? "";
  return Out.parse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
}
