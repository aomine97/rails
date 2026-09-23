import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "../ai/usage";

export const COACH_SYSTEM = `You are Coach inside Rails, a job-search app for STEM and nursing students and early-career people.
You answer from the user's own data in the CONTEXT block: their profile, their numbers, and their numbered applications. Never give generic advice when the data says something specific.
Rules:
- Lead with the answer in one or two sentences. Then at most three numbered points, each starting with a short bold claim written as **claim.**
- Quote their numbers and name the companies from their rows. If the data is too thin to answer, say exactly what is missing and what to do to get it.
- Never invent facts about employers, people, referrals, deadlines or pay. If you don't know, say so.
- Rails never submits applications or messages anyone; the user does. Suggest the next action they can take in Rails (Tracker, Tailor, Resume, Autopilot, Interview, Referrals) when it fits.
- Plain words. No filler, no "great question", no emoji. Under 180 words.
End with one line: SOURCES: the application numbers you used (e.g. 2, 5) or "profile" or "numbers", comma separated.`;

export type CoachTurn = { role: "user" | "assistant"; content: string };

/** -> { text, sources }. History is the last few turns so a follow-up question keeps its thread. */
export async function coachReply(context: string, history: CoachTurn[], question: string, client = new Anthropic()) {
  const model = process.env.COACH_MODEL ?? "claude-haiku-4-5";
  const messages: CoachTurn[] = [
    ...history.slice(-6),
    { role: "user", content: `CONTEXT\n${context}\n\nQUESTION\n${question.slice(0, 1500)}` },
  ];
  // the API needs the first turn to be the user's
  while (messages.length && messages[0]!.role !== "user") messages.shift();
  const res = await client.messages.create({ model, max_tokens: 700, system: COACH_SYSTEM, messages });
  recordUsage("coach", res.model ?? model, res.usage);
  const raw = res.content.find((c) => c.type === "text")?.text?.trim() ?? "";
  return splitSources(raw);
}

export function splitSources(raw: string): { text: string; sources: string[] } {
  const m = raw.match(/\n?\s*SOURCES:\s*(.+)\s*$/i);
  if (!m) return { text: raw, sources: [] };
  const sources = m[1]!.split(/[,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 12);
  return { text: raw.slice(0, m.index).trim(), sources };
}
