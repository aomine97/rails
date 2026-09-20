import { NextResponse } from "next/server";
import { cronAuth } from "../_auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { planOf } from "@/lib/billing/entitlements";
import { nightlyCap, pickAutopilot } from "@/lib/autopilot/pick";
import { generateTailored, validateTailored } from "@/lib/tailor/generate";
import type { FeedJobRow } from "@/lib/match/feed";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Nightly (06:30 ET). Phase 1: pick tonight's jobs for every user (queue rows). Phase 2: tailor for paid users up to the plan cap
 * and a global budget per run; leftovers are picked up by the next run (rows stay 'previewed' until prepared).
 * Free users get the same picks as a locked preview: the work is visible, the resumes are not made.
 */
export async function GET(req: Request) {
  const denied = await cronAuth(req); if (denied) return denied;
  const db = supabaseAdmin();
  const started = Date.now();
  const url = new URL(req.url);
  const maxTailors = Number(url.searchParams.get("max") ?? process.env.AUTOPILOT_MAX_TAILORS ?? 60);
  const sinceMs = Date.now() - 26 * 3600_000;
  const [{ data: users }, { data: rows }] = await Promise.all([
    db.from("profiles").select("id,canonical,autopilot_min_fit,alerts_where").eq("autopilot_enabled", true).eq("onboarding_done", true).not("canonical", "is", null),
    db.from("jobs").select("id,title,location,remote,url,apply_url,posted_at,first_seen_at,tags,pay_min,pay_max,pay_period,pay_currency,description_text,source,companies(name,ats,domain,logo_url)")
      .is("closed_at", null).not("tagged_at", "is", null).eq("source", "feed").gt("first_seen_at", new Date(sinceMs).toISOString()).order("first_seen_at", { ascending: false }).limit(3000),
  ]);
  const all = (rows ?? []) as unknown as FeedJobRow[];
  let picked = 0, prepared = 0, failed = 0; let firstError: string | null = null;
  const night = new Date().toISOString().slice(0, 10);

  // Phase 1: picks
  for (const u of users ?? []) {
    if (Date.now() - started > 90_000) break;
    const me = CanonicalProfile.safeParse(u.canonical); if (!me.success) continue;
    const plan = await planOf(db, u.id); const cap = nightlyCap(plan);
    const [{ data: q }, { data: marks }, { data: apps }] = await Promise.all([
      db.from("autopilot_queue").select("job_id").eq("user_id", u.id),
      db.from("matches").select("job_id").eq("user_id", u.id).eq("hidden", true),
      db.from("applications").select("job_id").eq("user_id", u.id),
    ]);
    const exclude = new Set<string>([...(q ?? []).map((x) => x.job_id), ...(marks ?? []).map((x) => x.job_id), ...(apps ?? []).map((x) => x.job_id).filter(Boolean) as string[]]);
    const picks = pickAutopilot(me.data, all, { minFit: u.autopilot_min_fit ?? 80, where: u.alerts_where ?? "us", exclude, max: cap.count, sinceMs });
    if (picks.length) {
      await db.from("autopilot_queue").upsert(picks.map((p) => ({ user_id: u.id, job_id: p.job.id, night, fit: p.score.fit, status: "previewed" })), { onConflict: "user_id,job_id", ignoreDuplicates: true });
      picked += picks.length;
    }
  }

  // Phase 2: prepare for paid users (oldest unprepared first), bounded by time and count
  const { data: pending } = await db.from("autopilot_queue").select("id,user_id,job_id,fit").eq("status", "previewed").order("created_at", { ascending: true }).limit(400);
  const planCache = new Map<string, Awaited<ReturnType<typeof planOf>>>();
  const profCache = new Map<string, CanonicalProfile>();
  let done = 0;
  for (const row of pending ?? []) {
    if (done >= maxTailors || Date.now() - started > 240_000) break;
    if (!planCache.has(row.user_id)) planCache.set(row.user_id, await planOf(db, row.user_id));
    if (!nightlyCap(planCache.get(row.user_id)!).prepare) continue; // Free: preview only
    if (!profCache.has(row.user_id)) { const { data: p } = await db.from("profiles").select("canonical").eq("id", row.user_id).single(); const me = CanonicalProfile.safeParse(p?.canonical); if (me.success) profCache.set(row.user_id, me.data); }
    const me = profCache.get(row.user_id); if (!me) continue;
    // already tailored for this job earlier (from the app or the extension)? reuse it
    const { data: existing } = await db.from("resumes").select("id,score").eq("user_id", row.user_id).eq("job_id", row.job_id).eq("kind", "tailored").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing) { await db.from("autopilot_queue").update({ status: "prepared", resume_id: existing.id, coverage: existing.score, prepared_at: new Date().toISOString() }).eq("id", row.id); prepared++; continue; }
    const { data: job } = await db.from("jobs").select("id,title,description_text,tags,companies(name)").eq("id", row.job_id).single();
    const tags = JobTags.safeParse(job?.tags); if (!job || !tags.success) continue;
    try {
      const out = await generateTailored(me, tags.data, { title: job.title, company: (job.companies as unknown as { name: string } | null)?.name ?? "", description: job.description_text ?? "" });
      const t = validateTailored(me, tags.data, out);
      const { data: saved } = await db.from("resumes").insert({ user_id: row.user_id, kind: "tailored", job_id: row.job_id, text_content: t.text, score: t.coverage.after, diff: t }).select("id").single();
      await db.from("autopilot_queue").update({ status: "prepared", resume_id: saved?.id ?? null, coverage: t.coverage.after, prepared_at: new Date().toISOString() }).eq("id", row.id);
      prepared++; done++;
    } catch (e) { failed++; firstError ??= String((e as Error).message).slice(0, 200); }
  }
  return NextResponse.json({ users: users?.length ?? 0, candidates: all.length, picked, prepared, failed, firstError, pendingLeft: Math.max(0, (pending?.length ?? 0) - prepared), ms: Date.now() - started });
}
