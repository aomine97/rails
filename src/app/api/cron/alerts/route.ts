import { NextResponse } from "next/server";
import { cronAuth } from "../_auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { planOf } from "@/lib/billing/entitlements";
import { siteUrl } from "@/lib/billing/stripe";
import { pickAlertJobs } from "@/lib/alerts/pick";
import { renderAlert } from "@/lib/alerts/email";
import { alertsConfigured, sendEmail } from "@/lib/alerts/send";
import type { FeedJobRow } from "@/lib/match/feed";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * ?kind=digest  daily, every user with alerts on: jobs since their last send (max 36h back).
 * ?kind=instant hourly, paid users only: jobs since their last send (max 3h back).
 * One email per user per run; nothing sent when nothing clears their fit floor.
 */
export async function GET(req: Request) {
  const denied = await cronAuth(req); if (denied) return denied;
  if (!alertsConfigured()) return NextResponse.json({ skipped: "RESEND_API_KEY / ALERTS_FROM not set" });
  const kind = new URL(req.url).searchParams.get("kind") === "instant" ? "instant" : "digest";
  const db = supabaseAdmin();
  const started = Date.now();
  const lookbackH = kind === "instant" ? 3 : 36;
  const floor = new Date(Date.now() - lookbackH * 3600_000).toISOString();
  const [{ data: users }, { data: rows }] = await Promise.all([
    db.from("profiles").select("id,email,full_name,canonical,alerts_min_fit,alerts_where,alerts_last_sent_at,unsubscribe_token").eq("alerts_enabled", true).eq("onboarding_done", true).not("canonical", "is", null),
    db.from("jobs").select("id,title,location,remote,url,apply_url,posted_at,first_seen_at,tags,pay_min,pay_max,pay_period,pay_currency,description_text,source,companies(name,ats,domain,logo_url)")
      .is("closed_at", null).not("tagged_at", "is", null).eq("source", "feed").gt("first_seen_at", floor).order("first_seen_at", { ascending: false }).limit(3000),
  ]);
  const all = (rows ?? []) as unknown as FeedJobRow[];
  let sent = 0, skipped = 0, failed = 0; let firstError: string | null = null;
  for (const u of users ?? []) {
    if (Date.now() - started > 240_000) break;
    try {
      const plan = await planOf(db, u.id);
      if (kind === "instant" && plan === "free") { skipped++; continue; }
      if (kind === "digest" && plan !== "free") { skipped++; continue; } // paid users get instant instead
      const parsed = CanonicalProfile.safeParse(u.canonical); if (!parsed.success) { skipped++; continue; }
      const since = u.alerts_last_sent_at && u.alerts_last_sent_at > floor ? u.alerts_last_sent_at : floor;
      const { data: marks } = await db.from("matches").select("job_id").eq("user_id", u.id).eq("hidden", true);
      const items = pickAlertJobs(parsed.data, all, { since, minFit: u.alerts_min_fit ?? 80, where: u.alerts_where ?? "us", hidden: new Set((marks ?? []).map((m) => m.job_id)) });
      if (items.length === 0) { skipped++; continue; }
      const msg = renderAlert({ name: u.full_name, items, kind, siteUrl: siteUrl(), unsubscribeUrl: `${siteUrl()}/api/alerts/unsubscribe?t=${u.unsubscribe_token}` });
      const providerId = await sendEmail(u.email, msg);
      await db.from("alert_sends").insert({ user_id: u.id, kind, job_ids: items.map((i) => i.job.id), provider_id: providerId });
      await db.from("profiles").update({ alerts_last_sent_at: new Date().toISOString() }).eq("id", u.id);
      sent++;
    } catch (e) { failed++; firstError ??= String((e as Error).message).slice(0, 200); }
  }
  return NextResponse.json({ kind, users: users?.length ?? 0, candidates: all.length, sent, skipped, failed, firstError, ms: Date.now() - started });
}
