import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "./plans";

export async function planOf(db: SupabaseClient, userId: string): Promise<Plan> {
  const { data } = await db.from("subscriptions").select("plan,current_period_end,paused_until").eq("user_id", userId).maybeSingle();
  if (!data) return "free";
  if (data.paused_until && new Date(data.paused_until) > new Date()) return "free";
  if ((data.plan === "pro" || data.plan === "semester") && (!data.current_period_end || new Date(data.current_period_end) > new Date())) return data.plan;
  return data.plan === "campus" ? "campus" : "free";
}

export type CreditResult = { ok: true; balance: number | "unlimited" } | { ok: false; refillAt: string | null };

/** Spend one AI credit for free users; unlimited on paid plans. Uses the atomic spend_credit() function. */
export async function spendCredit(db: SupabaseClient, userId: string, kind: "tailor" | "cover_letter" | "mock_interview", refId?: string): Promise<CreditResult> {
  const plan = await planOf(db, userId);
  if (plan !== "free") return { ok: true, balance: "unlimited" };
  const { data, error } = await db.rpc("spend_credit", { p_user: userId, p_kind: kind, p_ref: refId ?? null });
  if (error) throw error;
  if (data === -1) {
    const { data: c } = await db.from("credits").select("refill_at").eq("user_id", userId).maybeSingle();
    return { ok: false, refillAt: c?.refill_at ?? null };
  }
  return { ok: true, balance: data as number };
}

export function refillLabel(iso: string | null): string {
  if (!iso) return "soon";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3600_000), d = Math.floor(h / 24);
  return d >= 1 ? `${d}d ${h - d * 24}h` : `${h}h ${Math.floor((ms % 3600_000) / 60_000)}m`;
}
