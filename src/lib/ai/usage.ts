/** Model spend: a price table, a recorder, and the daily-budget check the tagger obeys.
 *  Prices are USD per million tokens (platform.claude.com/docs/en/about-claude/pricing, checked 2026-09-23).
 *  Batch is half price; cache reads are 0.1x input. */
export const PRICES: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-sonnet-4-5": { in: 3, out: 15 },
  "claude-opus-4-5": { in: 5, out: 25 },
};
export type Feature = "tag" | "tag_batch" | "triage" | "tailor" | "letter" | "answers" | "parse" | "coach" | "interview" | "referral" | "inbound";
export type Usage = { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null } | null | undefined;

export function costUsd(model: string, usage: Usage, batch = false): number {
  if (!usage) return 0;
  const p = PRICES[model] ?? PRICES[Object.keys(PRICES).find((k) => model.startsWith(k.split("-").slice(0, 2).join("-"))) ?? ""] ?? { in: 3, out: 15 };
  const f = batch ? 0.5 : 1;
  const input = (usage.input_tokens ?? 0) * p.in, cached = (usage.cache_read_input_tokens ?? 0) * p.in * 0.1, output = (usage.output_tokens ?? 0) * p.out;
  return ((input + cached + output) / 1_000_000) * f;
}

/** Fire-and-forget. Never throws and never blocks the caller; a meter must not break the product. */
export function recordUsage(feature: Feature, model: string, usage: Usage, batch = false): void {
  if (!usage || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const usd = costUsd(model, usage, batch);
  void import("@/lib/supabase/admin").then(({ supabaseAdmin }) => supabaseAdmin().from("ai_usage").insert({
    feature, model, batch, usd,
    input_tokens: usage.input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0, cache_read_tokens: usage.cache_read_input_tokens ?? 0,
  })).catch(() => { /* metering is best effort */ });
}

type Db = { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { in: (k: string, v: string[]) => PromiseLike<{ data: { usd: number | string }[] | null }> } } } };
/** What the background pipeline (tagging + triage) has spent today, UTC. */
export async function pipelineSpentToday(db: Db): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await db.from("ai_usage").select("usd").eq("day", day).in("feature", ["tag", "tag_batch", "triage"]);
  return (data ?? []).reduce((s, r) => s + Number(r.usd), 0);
}
/** The daily ceiling for background tagging. User-triggered features (tailor, letter, autofill) are never blocked by it. */
export const pipelineBudgetUsd = () => Number(process.env.TAG_DAILY_BUDGET_USD ?? 3);
