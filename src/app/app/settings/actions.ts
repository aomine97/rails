"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { makeAlias } from "@/lib/inbound/classify";
import { STAGES, type Stage } from "@/lib/tracker/stages";

export async function saveAlertSettings(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
  const enabled = form.get("enabled") === "on";
  const minFit = Math.min(100, Math.max(50, Number(form.get("minFit") ?? 80) || 80));
  const where = String(form.get("where") ?? "us").slice(0, 8);
  await supabase.from("profiles").update({ alerts_enabled: enabled, alerts_min_fit: minFit, alerts_where: where }).eq("id", user.id);
  revalidatePath("/app/settings");
}

/** Creates the user's forwarding address once. Retries on the (rare) unique collision. */
export async function createAlias() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
  const { data: p } = await supabase.from("profiles").select("full_name,forwarding_alias").eq("id", user.id).single();
  if (p?.forwarding_alias) return;
  for (let i = 0; i < 4; i++) {
    const { error } = await supabase.from("profiles").update({ forwarding_alias: makeAlias(p?.full_name ?? null) }).eq("id", user.id);
    if (!error) break;
  }
  revalidatePath("/app/settings");
}

export async function saveNudges(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
  await supabase.from("profiles").update({ nudges_enabled: form.get("nudges") === "on" }).eq("id", user.id);
  revalidatePath("/app/settings");
}

/** An email Rails couldn't place: the user points it at an application and, optionally, a stage. */
export async function assignInbound(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
  const id = Number(form.get("id")), appId = String(form.get("app") ?? ""), stage = String(form.get("stage") ?? "");
  if (!id || !appId) return;
  const { data: app } = await supabase.from("applications").select("id,stage,applied_at").eq("id", appId).eq("user_id", user.id).maybeSingle();
  if (!app) return;
  const now = new Date().toISOString();
  const to = (STAGES as string[]).includes(stage) && stage !== app.stage ? (stage as Stage) : null;
  if (to) {
    await supabase.from("applications").update({ stage: to, last_activity_at: now, ...(app.applied_at ? {} : { applied_at: now }) }).eq("id", appId);
    await supabase.from("application_events").insert({ application_id: appId, kind: "stage_change", from_stage: app.stage, to_stage: to, payload: { source: "email_assigned" } });
  }
  await supabase.from("inbound_emails").update({ application_id: appId, status: to ? "moved" : "matched", moved_to: to }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/app/settings"); revalidatePath("/app/tracker");
}

export async function dismissInbound(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
  await supabase.from("inbound_emails").update({ status: "ignored" }).eq("id", Number(form.get("id"))).eq("user_id", user.id);
  revalidatePath("/app/settings");
}

/** Deletes the account for good: cancels a live subscription, removes stored resume files, then the auth user
 *  (profiles and everything under it cascade). The user must type DELETE. */
export async function deleteAccount(form: FormData) {
  if (String(form.get("confirm") ?? "").trim() !== "DELETE") return;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();
  const { data: sub } = await admin.from("subscriptions").select("stripe_subscription_id,status").eq("user_id", user.id).maybeSingle();
  if (sub?.stripe_subscription_id && sub.status !== "canceled") {
    try { const { stripe } = await import("@/lib/billing/stripe"); await stripe().subscriptions.cancel(sub.stripe_subscription_id); } catch { /* Stripe unreachable: the webhook-less row goes with the account */ }
  }
  const { data: files } = await admin.storage.from("resumes").list(user.id, { limit: 1000 });
  if (files?.length) await admin.storage.from("resumes").remove(files.map((f) => `${user.id}/${f.name}`));
  await admin.auth.admin.deleteUser(user.id);
  await supabase.auth.signOut();
  const { redirect } = await import("next/navigation");
  redirect("/?deleted=1");
}
