"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { planOf } from "@/lib/billing/entitlements";
import { LIMITS } from "@/lib/billing/plans";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { scoreResume } from "@/lib/resume/score";
import { coachContext, coachFacts, type CoachApp } from "@/lib/coach/context";
import { coachReply, type CoachTurn } from "@/lib/coach/reply";

export type AskState = { error?: string; limited?: boolean } | null;

/** Loads the same facts the page shows, so the model and the screen never disagree. */
export async function loadCoach(userId: string) {
  const supabase = await supabaseServer();
  const [{ data: p }, { data: rows }, { data: tailored }] = await Promise.all([
    supabase.from("profiles").select("canonical").eq("id", userId).single(),
    supabase.from("applications").select("id,title,company_name,url,stage,applied_at,last_activity_at,next_action,next_action_at,notes,job_id,created_at").eq("user_id", userId).order("last_activity_at", { ascending: false }).limit(200),
    supabase.from("resumes").select("job_id").eq("user_id", userId).eq("kind", "tailored"),
  ]);
  const parsed = CanonicalProfile.safeParse(p?.canonical);
  const profile = parsed.success ? parsed.data : null;
  const tJobs = new Set((tailored ?? []).map((r) => r.job_id as string));
  const apps: CoachApp[] = (rows ?? []).map((r) => ({ ...(r as CoachApp), tailored: !!r.job_id && tJobs.has(r.job_id as string) }));
  const now = Date.now();
  const facts = coachFacts(profile, apps, now, profile ? scoreResume(profile).total : null);
  return { supabase, profile, apps, facts, now };
}

export async function askCoach(_prev: AskState, form: FormData): Promise<AskState> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const q = String(form.get("q") ?? "").trim().slice(0, 1500);
  if (!q) return null;
  const plan = await planOf(supabase, user.id);
  const cap = LIMITS[plan].coachMessagesPerDay;
  if (cap !== "unlimited") {
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase.from("coach_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "user").gte("created_at", since.toISOString());
    if ((count ?? 0) >= cap) return { limited: true };
  }
  const { facts, apps, now } = await loadCoach(user.id);
  const { data: hist } = await supabase.from("coach_messages").select("role,content").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6);
  const history = ((hist ?? []) as CoachTurn[]).reverse();
  await supabase.from("coach_messages").insert({ user_id: user.id, role: "user", content: q });
  try {
    const { text, sources } = await coachReply(coachContext(facts, apps, now), history, q);
    await supabase.from("coach_messages").insert({ user_id: user.id, role: "assistant", content: text || "I couldn't form an answer. Try asking it another way.", sources });
  } catch {
    await supabase.from("coach_messages").insert({ user_id: user.id, role: "assistant", content: "Coach is unavailable right now. Your question is saved; ask again in a minute." });
  }
  revalidatePath("/app/coach");
  return null;
}

export async function clearCoach() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("coach_messages").delete().eq("user_id", user.id);
  revalidatePath("/app/coach");
}
