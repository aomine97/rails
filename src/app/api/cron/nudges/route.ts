import { NextResponse } from "next/server";
import { cronAuth } from "../_auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/billing/stripe";
import { alertsConfigured, sendEmail } from "@/lib/alerts/send";
import { upNext, type TrackedApp } from "@/lib/tracker/stages";
import { renderNudge } from "@/lib/inbound/nudge";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Daily. One email per user whose follow-ups are due or overdue (suggestions count once they are 7+ days quiet). */
export async function GET(req: Request) {
  const denied = await cronAuth(req); if (denied) return denied;
  if (!alertsConfigured()) return NextResponse.json({ skipped: "RESEND_API_KEY / ALERTS_FROM not set" });
  const db = supabaseAdmin();
  const now = Date.now();
  const cutoff = new Date(now - 20 * 3600_000).toISOString();
  const { data: users } = await db.from("profiles").select("id,email,full_name,nudges_last_sent_at,unsubscribe_token").eq("nudges_enabled", true).eq("onboarding_done", true);
  let sent = 0, skipped = 0, failed = 0;
  for (const u of users ?? []) {
    if (Date.now() - now > 240_000) break;
    if (u.nudges_last_sent_at && u.nudges_last_sent_at > cutoff) { skipped++; continue; }
    const { data: apps } = await db.from("applications").select("id,title,company_name,url,stage,applied_at,last_activity_at,next_action,next_action_at,notes,job_id,created_at").eq("user_id", u.id);
    const items = upNext((apps ?? []) as TrackedApp[], now).slice(0, 8);
    if (!items.length) { skipped++; continue; }
    try {
      await sendEmail(u.email, renderNudge({ name: u.full_name, items, siteUrl: siteUrl(), unsubscribeUrl: `${siteUrl()}/api/alerts/unsubscribe?t=${u.unsubscribe_token}&what=nudges` }));
      await db.from("profiles").update({ nudges_last_sent_at: new Date().toISOString() }).eq("id", u.id);
      sent++;
    } catch { failed++; }
  }
  return NextResponse.json({ sent, skipped, failed });
}
