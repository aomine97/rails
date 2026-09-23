import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "../ai/usage";
import { TAGGER_MODEL } from "./tagger";

/** Title triage: is this a job Rails would ever show? One cheap call per 100 titles, before the full tagger reads a single
 *  description. Before this existed, about three quarters of fully tagged jobs came back "not STEM" and were thrown away. */
export const TRIAGE_SYSTEM = `You screen job titles for a job board that only lists STEM and nursing roles for students and early-career people.
Answer yes (1) for: software, web, mobile, data, analytics, machine learning, AI, IT, help desk, network, systems, cloud, DevOps, cybersecurity, QA/test, product and technical program roles; engineering of any discipline (electrical, mechanical, civil, chemical, aerospace, biomedical, industrial, manufacturing, materials, environmental); science and lab roles (biology, chemistry, physics, research); math, statistics, actuarial, quantitative; nursing (RN, LPN, CNA, nurse residency) and allied health (lab tech, radiology, pharmacy tech, respiratory, PT/OT assistant, EMT, medical assistant).
Answer no (0) for: sales, account executive, retail, hospitality, food service, admin and office, HR and recruiting, finance and accounting that is not quantitative, marketing, legal, construction trades, drivers, warehouse, customer service, and any title that is clearly senior, staff, principal, director, VP, head of, or manager.
Interns, co-ops, new grads, associates, analysts, technicians and "I/II" levels are yes when the field is yes. When unsure, answer yes: a wrong yes costs one tag, a wrong no hides a real job.
Return only JSON: {"yes":[the numbers that are yes]}.`;

export type TriageItem = { id: string; title: string; company?: string | null };

/** -> the ids that are yes. Throws on an unreadable answer so the caller can leave the batch untriaged and retry. */
export async function triageTitles(items: TriageItem[], client = new Anthropic()): Promise<Set<string>> {
  if (!items.length) return new Set();
  const list = items.map((it, i) => `${i + 1}. ${it.title.replace(/\s+/g, " ").slice(0, 140)}${it.company ? ` — ${it.company.slice(0, 40)}` : ""}`).join("\n");
  const model = TAGGER_MODEL();
  const res = await client.messages.create({ model, max_tokens: 800, system: TRIAGE_SYSTEM, messages: [{ role: "user", content: list }] });
  recordUsage("triage", model, res.usage);
  const raw = res.content.find((c) => c.type === "text")?.text ?? "";
  const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { yes?: unknown };
  if (!Array.isArray(json.yes)) throw new Error("triage: no yes list");
  const yes = new Set<string>();
  for (const n of json.yes) { const i = Number(n) - 1; if (Number.isInteger(i) && i >= 0 && i < items.length) yes.add(items[i]!.id); }
  return yes;
}
