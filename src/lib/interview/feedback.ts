import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { recordUsage } from "../ai/usage";
import type { CanonicalProfile } from "../schemas/profile";

/** Filler words, counted without a model. "like" only counts as filler when it's followed by a comma or a pause word. */
export function fillers(answer: string): { total: number; top: [string, number][] } {
  const text = ` ${answer.toLowerCase().replace(/[’']/g, "'")} `;
  const pats: [string, RegExp][] = [["um", /\bu+m+\b/g], ["uh", /\bu+h+\b/g], ["like", /\blike,|\blike (um|uh|so|you know)\b/g], ["you know", /\byou know\b/g], ["basically", /\bbasically\b/g], ["I guess", /\bi guess\b/g], ["kind of", /\bkind of\b/g], ["sort of", /\bsort of\b/g], ["honestly", /\bhonestly\b/g]];
  const counts = pats.map(([k, re]) => [k, (text.match(re) ?? []).length] as [string, number]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return { total: counts.reduce((s, [, n]) => s + n, 0), top: counts.slice(0, 3) };
}

const STOP = new Set("a an the and or but so to of in on at for with from by as is are was were be been being i me my we our you your it its this that these those there here they them their he she his her not no do did does have has had will would can could should just very really also then than into over about up out if when what which who how why".split(" "));
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

/** "Your words only": the stronger version may reorder and trim, not add. Share of its content words not in the answer. */
export function novelty(answer: string, stronger: string): number {
  const have = new Set(words(answer).map((w) => w.replace(/s$/, "")));
  const ws = words(stronger).map((w) => w.replace(/s$/, ""));
  if (!ws.length) return 0;
  return ws.filter((w) => !have.has(w)).length / ws.length;
}

export const Feedback = z.object({
  score: z.coerce.number().int().min(0).max(10),
  keep: z.array(z.string()).max(3).default([]),
  cut: z.array(z.string()).max(3).default([]),
  tighten: z.array(z.string()).max(3).default([]),
  stronger: z.string().default(""),
});
export type Feedback = z.infer<typeof Feedback> & { fillers: ReturnType<typeof fillers>; strongerDropped?: boolean };

export const GRADE_SYSTEM = `You coach a candidate through a mock interview answer. Be specific and short, like a good senior engineer or nurse manager would be.
Return only JSON: {"score": 0-10, "keep": [what worked, quote their words], "cut": [what hurts, and why an interviewer hears it that way], "tighten": [what to restructure], "stronger": "a stronger version of THEIR answer"}.
Rules for "stronger": use only facts and words already in their answer. Reorder, cut, and join. Never add a skill, number, employer, story or claim they didn't say. If the answer is too thin to improve without inventing, return "".
Scoring: 8-10 specific, structured, answers the question; 5-7 relevant but vague or rambling; 0-4 off-topic or empty. Each list item under 30 words.`;

export async function gradeAnswer(input: { question: string; answer: string; role: string; profile: CanonicalProfile | null }, client = new Anthropic()): Promise<Feedback> {
  const model = process.env.INTERVIEW_MODEL ?? "claude-haiku-4-5";
  const res = await client.messages.create({
    model, max_tokens: 900, system: GRADE_SYSTEM,
    messages: [{ role: "user", content: `ROLE: ${input.role}\nCANDIDATE BACKGROUND: ${input.profile?.headline ?? ""} ${input.profile?.experience.slice(0, 3).map((e) => `${e.title} at ${e.org}`).join("; ") ?? ""}\n\nQUESTION: ${input.question}\n\nANSWER (transcribed, filler words included):\n${input.answer.slice(0, 4000)}` }],
  });
  recordUsage("interview", res.model ?? model, res.usage);
  const raw = res.content.find((c) => c.type === "text")?.text ?? "";
  const parsed = Feedback.parse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
  const tooNew = parsed.stronger && novelty(input.answer, parsed.stronger) > 0.25;
  return { ...parsed, stronger: tooNew ? "" : parsed.stronger, strongerDropped: !!tooNew, fillers: fillers(input.answer) };
}
