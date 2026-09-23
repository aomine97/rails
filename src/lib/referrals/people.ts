import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "../ai/usage";
import type { CanonicalProfile } from "../schemas/profile";

/** Rails doesn't scrape LinkedIn or keep a people database. It builds the searches a careful student would run and
 *  opens them in the user's own browser, then tracks who they asked. */
export type Search = { label: string; why: string; url: string; relation: "alum" | "recruiter" | "team" };

const li = (keywords: string) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;

export function peopleSearches(company: string, role: string | null, school: string | null): Search[] {
  const out: Search[] = [];
  const c = company.trim();
  if (school) out.push({ label: `${school} alumni at ${c}`, why: "Same school: the warmest cold message there is.", url: li(`${school} ${c}`), relation: "alum" });
  if (role) out.push({ label: `${role.replace(/\b(intern(ship)?|summer \d{4}|20\d\d)\b/gi, "").replace(/[,\s]+$/, "").trim()} at ${c}`, why: "People doing the job. Ask what the team looks for.", url: li(`${role.split(/[,(]/)[0]} ${c}`), relation: "team" });
  out.push({ label: `University recruiters at ${c}`, why: "They own the intern and new-grad pipeline.", url: li(`${c} university recruiter`), relation: "recruiter" });
  out.push({ label: `Recruiters at ${c}`, why: "For experienced roles and anything off-cycle.", url: li(`${c} technical recruiter`), relation: "recruiter" });
  return out;
}

/** LinkedIn's connection-note limit is 300 characters; notes are trimmed at a sentence boundary under it. */
export function fitNote(text: string, max = 300): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return (end > 120 ? cut.slice(0, end + 1) : cut.slice(0, max - 1).replace(/\s+\S*$/, "") + "…").trim();
}

export const NOTE_SYSTEM = `You write a short first message from a student or early-career candidate to someone at a company.
Rules: under 280 characters for LinkedIn, under 700 for email. Ask for advice or 10 minutes, not a referral; that's how referrals happen.
Use one specific, true detail from the candidate's profile that connects to the person (same school, same kind of work). Never invent a shared connection, event or fact.
No "pick your brain", no "I hope this finds you well", no resume attachment, no emoji. Sign with the candidate's first name. Return only the message text.`;

export async function draftNote(input: { profile: CanonicalProfile; company: string; role: string | null; person: { name: string; role: string | null; relation: string }; channel: "linkedin" | "email" | "other" }, client = new Anthropic()): Promise<string> {
  const model = process.env.REFERRAL_MODEL ?? "claude-haiku-4-5";
  const p = input.profile;
  const res = await client.messages.create({
    model, max_tokens: 400, system: NOTE_SYSTEM,
    messages: [{ role: "user", content: `CHANNEL: ${input.channel}\nTO: ${input.person.name}, ${input.person.role ?? "role unknown"} at ${input.company} (${input.person.relation})\nCANDIDATE: ${p.name}; ${p.education.map((e) => `${e.degree} ${e.field}, ${e.school}${e.gradYear ? ` '${String(e.gradYear).slice(2)}` : ""}`).join("; ")}; ${p.experience.slice(0, 2).map((e) => `${e.title} at ${e.org}`).join("; ")}\nAPPLYING FOR: ${input.role ?? "roles at this company"}` }],
  });
  recordUsage("referral", res.model ?? model, res.usage);
  const text = (res.content.find((c) => c.type === "text")?.text ?? "").trim().replace(/^"|"$/g, "");
  return input.channel === "linkedin" ? fitNote(text) : text.slice(0, 1200);
}
