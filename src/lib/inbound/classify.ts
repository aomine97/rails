/** Inbound email -> tracker stage. Rules first (free, explainable); the route asks a small model only when no rule fires.
 *  Only the subject, sender and a 200-character snippet are ever stored; the body is read once and dropped. */
import type { Stage } from "../tracker/stages";

export type EmailKind = "confirmation" | "rejection" | "oa" | "interview" | "offer" | "other";

const RULES: [EmailKind, RegExp][] = [
  ["offer", /\b(pleased|delighted|excited|happy) to (extend|offer)\b|\boffer letter\b|\bformal offer\b|\byour offer\b/i],
  ["rejection", /\b(unfortunately|regret to inform|not (be )?moving forward|decided to (move forward|proceed) with other|other candidates|not selected|position has been filled|will not be moving|no longer under consideration|pursue other candidates)\b/i],
  ["oa", /\b(hackerrank|codesignal|codility|hirevue|karat|online assessment|coding (challenge|assessment|test)|technical assessment|take-home|assessment invitation|complete (the|an|your) assessment)\b/i],
  ["interview", /\b(schedule (an? |your )?(interview|call|chat|time)|interview (invitation|request)|phone screen|next round|availability for|would like to (speak|chat|talk|meet)|invite you to (an? )?interview|calendly\.com|goodtime\.io)\b/i],
  ["confirmation", /\b(received your application|thank(s| you) for (applying|your application|your interest)|application (has been )?(received|submitted)|we('ve| have) received)\b/i],
];

export function classifyEmail(subject: string, text: string): EmailKind | null {
  const hay = `${subject}\n${text.slice(0, 4000)}`;
  for (const [k, re] of RULES) if (re.test(hay)) return k;
  return null;
}

export const KIND_STAGE: Record<EmailKind, Stage | null> = { confirmation: "applied", rejection: "rejected", oa: "oa", interview: "interview", offer: "offer", other: null };

const ORDER: Stage[] = ["saved", "prepared", "applied", "viewed", "oa", "interview", "offer"];
/** Stages only move forward, except a rejection, which can land at any point before an offer. Offer and withdrawn never move. */
export function nextStage(current: Stage, kind: EmailKind): Stage | null {
  const to = KIND_STAGE[kind];
  if (!to || current === "offer" || current === "withdrawn") return null;
  if (to === "rejected") return current === "rejected" ? null : "rejected";
  if (current === "rejected") return null;
  return ORDER.indexOf(to) > ORDER.indexOf(current) ? to : null;
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/\b(inc|llc|ltd|corp|corporation|co|company|group|holdings|technologies|technology|the)\b\.?/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

/** Which application is this email about? Company name in the sender's display name, domain, subject or opening text.
 *  Longest company name wins so "Capital One" beats "One". Most recent application of that company wins. */
export function matchApplication<A extends { id: string; company_name: string; title: string; last_activity_at: string }>(apps: A[], from: string, subject: string, text: string): A | null {
  const hay = ` ${norm(`${from} ${subject} ${text.slice(0, 1500)}`)} `;
  const domain = (from.match(/@([a-z0-9.-]+)/i)?.[1] ?? "").toLowerCase();
  const scored = apps.map((a) => {
    const n = norm(a.company_name);
    if (!n) return { a, s: 0 };
    let s = hay.includes(` ${n} `) ? n.length : 0;
    const compact = n.replace(/ /g, "");
    if (compact.length >= 3 && domain.split(".").some((part) => part === compact)) s = Math.max(s, compact.length + 5);
    if (s && hay.includes(norm(a.title))) s += 10;
    return { a, s };
  }).filter((x) => x.s > 0);
  scored.sort((x, y) => y.s - x.s || Date.parse(y.a.last_activity_at) - Date.parse(x.a.last_activity_at));
  return scored[0]?.a ?? null;
}

/** Postmark, Resend and SendGrid-parse shapes, plus a plain {from,to,subject,text}. */
export function parseInbound(body: Record<string, unknown>): { from: string; to: string[]; subject: string; text: string } {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
  const toRaw = data.To ?? data.to ?? data.recipient ?? "";
  const to = (Array.isArray(toRaw) ? toRaw.map((x) => (typeof x === "string" ? x : s((x as Record<string, unknown>)?.Email ?? (x as Record<string, unknown>)?.email))) : s(toRaw).split(","))
    .map((x) => x.trim().toLowerCase()).filter(Boolean);
  const fromRaw = data.From ?? data.from ?? data.sender ?? "";
  const from = typeof fromRaw === "string" ? fromRaw : s((fromRaw as Record<string, unknown>)?.email ?? (fromRaw as Record<string, unknown>)?.Email);
  const text = s(data.TextBody ?? data.text ?? data["body-plain"] ?? data.StrippedTextReply) || s(data.HtmlBody ?? data.html).replace(/<[^>]+>/g, " ");
  return { from, to, subject: s(data.Subject ?? data.subject), text: text.replace(/\s+/g, " ").trim() };
}

/** "maya-4k2@in.example.com" -> "maya-4k2". */
export function aliasOf(addresses: string[], domain: string): string | null {
  for (const a of addresses) {
    const m = a.match(/<?([a-z0-9._+-]+)@([a-z0-9.-]+)>?/i);
    if (m && m[2]!.toLowerCase() === domain.toLowerCase()) return m[1]!.toLowerCase().split("+")[0]!;
  }
  return null;
}

export function makeAlias(name: string | null, rand: () => number = Math.random): string {
  const base = (name ?? "me").toLowerCase().split(/\s+/)[0]!.replace(/[^a-z0-9]/g, "").slice(0, 12) || "me";
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return `${base}-${Array.from({ length: 4 }, () => abc[Math.floor(rand() * abc.length)]).join("")}`;
}
