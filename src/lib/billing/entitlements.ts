import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "./plans";

export async function planOf(db: SupabaseClient, userId: string): Promise<Plan> {
  const { data } = await db.from("subscriptions").select("plan,current_period_end,paused_until").eq("user_id", userId).maybeSingle();
  if (data && !(data.paused_until && new Date(data.paused_until) > new Date())) {
    if ((data.plan === "pro" || data.plan === "semester") && (!data.current_period_end || new Date(data.current_period_end) > new Date())) return data.plan;
    if (data.plan === "campus") return "campus";
  }
  // Campus plan: the student's school has a live pilot or paid term (profiles.campus_id is set by email domain).
  try {
    const { data: live } = await db.rpc("campus_active", { p_user: userId });
    if (live === true) return "campus";
  } catch { /* function missing before migration 0018: treat as free */ }
  return "free";
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

export type Feature = "tailor" | "cover_letter" | "mock_interview" | "autopilot_submit" | "coach" | "referrals" | "resume_rescore" | "instant_alerts";

export type Entitlement =
  | { ok: true; plan: Plan; credits: number | "unlimited" }
  | { ok: false; plan: Plan; reason: "credits" | "plan"; refillAt: string | null; credits: number };

/**
 * Read-only check (spends nothing): can this user use the feature right now?
 * Credit features: paid plans always yes; free needs balance > 0 (lazy refill is computed by spend_credit, so we mirror it here).
 * Plan features: paid plans only.
 */
export async function can(db: SupabaseClient, userId: string, feature: Feature): Promise<Entitlement> {
  const plan = await planOf(db, userId);
  if (plan !== "free") return { ok: true, plan, credits: "unlimited" };
  const creditFeature = feature === "tailor" || feature === "cover_letter" || feature === "mock_interview";
  if (!creditFeature) {
    return { ok: false, plan, reason: "plan", refillAt: null, credits: 0 };
  }
  const { data: c } = await db.from("credits").select("balance,refill_at").eq("user_id", userId).maybeSingle();
  const refillDue = c?.refill_at ? new Date(c.refill_at) <= new Date() : false;
  const balance = refillDue ? 3 : (c?.balance ?? 3);
  if (balance > 0) return { ok: true, plan, credits: balance };
  return { ok: false, plan, reason: "credits", refillAt: c?.refill_at ?? null, credits: 0 };
}

export type SubRow = { plan: Plan; student_price: boolean; status: string; current_period_end: string | null; paused_until: string | null; cancel_at: string | null; started_at: string | null; stripe_customer_id: string | null; stripe_subscription_id: string | null };

export async function subscriptionOf(db: SupabaseClient, userId: string): Promise<SubRow | null> {
  const { data } = await db.from("subscriptions").select("plan,student_price,status,current_period_end,paused_until,cancel_at,started_at,stripe_customer_id,stripe_subscription_id").eq("user_id", userId).maybeSingle();
  return (data as SubRow | null) ?? null;
}

/** 7-day refund window from the first paid date. */
export function refundEligible(startedAt: string | null, now = new Date()): boolean {
  if (!startedAt) return false;
  return now.getTime() - new Date(startedAt).getTime() <= 7 * 86_400_000;
}
