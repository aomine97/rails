import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { recordUsage } from "../ai/usage";

/** OA drills: one practice problem at the level of the posting, a timer, and a review of the approach.
 *  Nothing runs the code; the review reads it like an interviewer would. */
export const Drill = z.object({
  title: z.string(),
  prompt: z.string(),
  examples: z.array(z.object({ input: z.string(), output: z.string(), note: z.string().optional() })).min(1).max(4),
  constraints: z.array(z.string()).max(6).default([]),
  hints: z.array(z.string()).min(1).max(3),
  approach: z.string(),
  complexity: z.string().default(""),
  language: z.string().default("Python"),
  minutes: z.coerce.number().int().catch(25).default(25).transform((n) => Math.min(60, Math.max(10, n))),
  topic: z.string().default(""),
});
export type Drill = z.infer<typeof Drill>;

export const Review = z.object({
  verdict: z.enum(["correct", "mostly", "wrong", "incomplete"]).catch("incomplete"),
  issues: z.array(z.string()).max(5).default([]),
  edgeCases: z.array(z.string()).max(4).default([]),
  complexity: z.string().default(""),
  next: z.string().default(""),
});
export type Review = z.infer<typeof Review>;

const TOPICS = ["arrays and hashing", "two pointers", "sliding window", "stacks", "binary search", "strings", "intervals", "BFS/DFS on grids", "heaps", "prefix sums"];
/** Rotate topics so repeated drills don't repeat. */
export function pickTopic(done: string[]): string {
  const seen = new Set(done.map((t) => t.toLowerCase()));
  return TOPICS.find((t) => !seen.has(t)) ?? TOPICS[done.length % TOPICS.length]!;
}

const JSON_ONLY = (s: string) => JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1));

export async function generateDrill(input: { topic: string; level: string; language: string; company: string | null }, client = new Anthropic()): Promise<Drill> {
  const model = process.env.INTERVIEW_MODEL ?? "claude-haiku-4-5";
  const res = await client.messages.create({
    model, max_tokens: 1400,
    system: `You write one original online-assessment practice problem, the kind HackerRank and CodeSignal screens use for ${input.level} candidates. Original wording; never copy a known problem's text. Return only JSON: {"title","prompt","examples":[{"input","output","note"}],"constraints":[...],"hints":[three hints, gentle to strong],"approach": the intended solution in 3-5 sentences,"complexity","language","minutes","topic"}.`,
    messages: [{ role: "user", content: `Topic: ${input.topic}. Language: ${input.language}. Difficulty: easy-to-medium for ${input.level}.${input.company ? ` The candidate is preparing for ${input.company}'s OA; don't claim to know their questions.` : ""}` }],
  });
  recordUsage("interview", res.model ?? model, res.usage);
  return Drill.parse(JSON_ONLY(res.content.find((c) => c.type === "text")?.text ?? ""));
}

export async function reviewSolution(drill: Drill, code: string, client = new Anthropic()): Promise<Review> {
  const model = process.env.INTERVIEW_MODEL ?? "claude-haiku-4-5";
  const res = await client.messages.create({
    model, max_tokens: 800,
    system: `You review a candidate's solution to a practice problem without running it. Trace it on the examples in your head. Return only JSON: {"verdict":"correct"|"mostly"|"wrong"|"incomplete","issues":[specific bugs with the line or idea],"edgeCases":[inputs it would fail],"complexity":"time and space of THEIR code","next":"one sentence on what to practice next"}. Don't rewrite their solution.`,
    messages: [{ role: "user", content: `PROBLEM: ${drill.title}\n${drill.prompt}\nEXAMPLES: ${JSON.stringify(drill.examples)}\nCONSTRAINTS: ${drill.constraints.join("; ")}\n\nSOLUTION (${drill.language}):\n${code.slice(0, 8000)}` }],
  });
  recordUsage("interview", res.model ?? model, res.usage);
  return Review.parse(JSON_ONLY(res.content.find((c) => c.type === "text")?.text ?? ""));
}
