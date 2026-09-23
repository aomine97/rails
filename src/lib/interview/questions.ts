import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { recordUsage } from "../ai/usage";
import type { CanonicalProfile } from "../schemas/profile";

export type Mode = "phone" | "technical" | "behavioral";
export const MODE_LABEL: Record<Mode, string> = { phone: "Phone screen", technical: "Technical", behavioral: "Behavioral" };

export const QuestionSet = z.object({
  questions: z.array(z.object({ q: z.string().min(5), kind: z.enum(["behavioral", "technical", "role", "motivation", "logistics"]).catch("role"), why: z.string().default("") })).min(4).max(10),
});
export type InterviewQuestion = z.infer<typeof QuestionSet>["questions"][number];

const SYSTEM = `You write mock interview questions for one specific candidate and one specific job.
Return only JSON: {"questions":[{"q": the question as the interviewer would say it, "kind": "behavioral"|"technical"|"role"|"motivation"|"logistics", "why": one short line on what the interviewer is checking}]}.
Write 8 questions. Mix by mode:
- phone: 2 motivation (why this company, why this role), 3 about their own resume lines, 2 role basics, 1 logistics (availability, location, start).
- technical: 5 technical at the level of the posting (concepts, debugging, a small design or scenario; nursing: clinical scenarios, prioritization, safety), 2 about projects on their resume, 1 "what if you don't know".
- behavioral: 6 behavioral in STAR territory (conflict, failure, ownership, pressure, teamwork, learning fast), 2 about the company or role.
Name the company and their real resume items where it fits. Never invent facts about the company (no made-up products, values or interview processes). No coding problems that need an editor.`;

export async function generateQuestions(input: { profile: CanonicalProfile; mode: Mode; title: string; company: string | null; description: string | null; requirements: string[] }, client = new Anthropic()): Promise<InterviewQuestion[]> {
  const model = process.env.INTERVIEW_MODEL ?? "claude-haiku-4-5";
  const p = input.profile;
  const resume = p.experience.slice(0, 5).map((e) => `${e.title} at ${e.org}: ${e.bullets.slice(0, 3).join(" / ")}`).join("\n");
  const res = await client.messages.create({
    model, max_tokens: 1500, system: SYSTEM,
    messages: [{ role: "user", content: `MODE: ${input.mode}\nJOB: ${input.title}${input.company ? ` at ${input.company}` : ""}\nREQUIREMENTS: ${input.requirements.slice(0, 10).join(" | ") || "not listed"}\n${(input.description ?? "").slice(0, 3000)}\n\nCANDIDATE: ${p.headline ?? ""}\nEDUCATION: ${p.education.map((e) => `${e.degree} ${e.field}, ${e.school}`).join("; ")}\nSKILLS: ${p.skills.slice(0, 25).map((s) => s.name).join(", ")}\nRESUME:\n${resume}` }],
  });
  recordUsage("interview", res.model ?? model, res.usage);
  const raw = res.content.find((c) => c.type === "text")?.text ?? "";
  return QuestionSet.parse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1))).questions.slice(0, 8);
}
