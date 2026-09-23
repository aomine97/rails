import { NextResponse } from "next/server";
import { cronAuth } from "../_auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tagJob } from "@/lib/jobs/tagger";
import { pretag, EMPTY_TAGS } from "@/lib/jobs/tags";
import { triageTitles } from "@/lib/jobs/triage";
import { pipelineSpentToday, pipelineBudgetUsd } from "@/lib/ai/usage";
import { adapters, type RawJob } from "@/lib/ats";
import { applyTags } from "@/lib/jobs/apply-tags";
import { collectTagBatches } from "@/lib/jobs/batch";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Every 10 min. (0) collects finished batches, pre-tags obvious titles, (t) triages new titles with one cheap call per 100,
 *  (a) fills in descriptions for triage-yes jobs only, (b) tags only fresh triage-yes jobs online (the backlog goes to the
 *  half-price batch every 6 hours), all behind a daily budget. */
export async function GET(req: Request) {
  const denied = await cronAuth(req); if (denied) return denied;
  const db = supabaseAdmin();
  const started = Date.now();
  const budgetMs = 200_000; // stay well under maxDuration
  const url = new URL(req.url);
  const enrichN = Number(url.searchParams.get("enrich") ?? 32), tagN = Number(url.searchParams.get("tag") ?? process.env.TAG_REALTIME_MAX ?? 20);
  const triageN = Number(url.searchParams.get("triage") ?? 1000);
  const collected = await collectTagBatches(db, 60_000).catch((e) => [{ id: "error", status: String((e as Error).message).slice(0, 200), tagged: 0, failed: 0, done: false }]);
  // (0) pre-tag: titles that are clearly senior/management or clearly not tech get a stub tag with no model call
  const { data: raw } = await db.from("jobs").select("id,title").is("tagged_at", null).is("closed_at", null).eq("source", "feed").order("first_seen_at", { ascending: false }).limit(400);
  let pretagged = 0;
  for (const j of raw ?? []) {
    const t = pretag(j.title);
    if (t) { await db.from("jobs").update({ tags: t, tagged_at: new Date().toISOString(), description_text: "" }).eq("id", j.id); pretagged++; }
  }
  // (t) triage: one Haiku call per 100 titles; "no" gets a stub tag and never costs a full tag
  const budget = pipelineBudgetUsd();
  let spent = await pipelineSpentToday(db as never).catch(() => 0);
  let triagedYes = 0, triagedNo = 0; let triageError: string | null = null;
  if (spent < budget) {
    const { data: untriaged } = await db.from("jobs").select("id,title,companies(name)").is("tagged_at", null).is("triaged_at", null).is("closed_at", null).eq("source", "feed")
      .order("first_seen_at", { ascending: false }).limit(triageN);
    const rows = (untriaged ?? []).map((j) => ({ id: j.id as string, title: j.title as string, company: (j as unknown as { companies: { name: string } | null }).companies?.name ?? null }));
    for (let i = 0; i < rows.length && Date.now() - started < budgetMs / 3; i += 100) {
      const chunk = rows.slice(i, i + 100);
      try {
        const yes = await triageTitles(chunk);
        const now = new Date().toISOString();
        const yesIds = chunk.filter((r) => yes.has(r.id)).map((r) => r.id), noIds = chunk.filter((r) => !yes.has(r.id)).map((r) => r.id);
        if (yesIds.length) await db.from("jobs").update({ triage: "yes", triaged_at: now }).in("id", yesIds);
        if (noIds.length) await db.from("jobs").update({ triage: "no", triaged_at: now, tags: { ...EMPTY_TAGS, field: "other", summary: "" }, tagged_at: now, description_text: "" }).in("id", noIds); // never shown, so never stored
        triagedYes += yesIds.length; triagedNo += noIds.length;
      } catch (e) { triageError ??= String((e as Error).message).slice(0, 200); }
    }
  }
  // (a) enrich jobs with no description yet (Workday / SmartRecruiters list-only rows)
  const { data: bare } = await db.from("jobs").select("id,ats,external_id,title,location,url,apply_url,companies(name,ats,slug,tenant,wdn,careers_url)")
    .is("description_text", null).is("closed_at", null).eq("triage", "yes").order("first_seen_at", { ascending: false }).limit(enrichN);
  let enrichedCount = 0;
  for (const j of bare ?? []) {
    if (Date.now() - started > budgetMs / 2) break;
    const co = (j as unknown as { companies: { name: string; ats: RawJob["ats"]; slug: string | null; tenant: string | null; wdn: number | null; careers_url: string | null } | null }).companies;
    const fn = co ? adapters[co.ats]?.enrich : undefined;
    if (!co || !fn) { await db.from("jobs").update({ description_text: "" }).eq("id", j.id); continue; } // nothing to fetch; stop retrying
    try {
      const e = await fn({ name: co.name, ats: co.ats, slug: co.slug, tenant: co.tenant, wdn: co.wdn, careersUrl: co.careers_url },
        { ats: co.ats, companySlug: co.slug ?? "", externalId: j.external_id, title: j.title, location: j.location, remote: null, employmentType: null, department: null, descriptionHtml: null, descriptionText: null, url: j.url, applyUrl: j.apply_url, postedAt: null, pay: null });
      await db.from("jobs").update({ description_html: null, description_text: e.descriptionText ?? "", title: e.title, location: e.location, employment_type: e.employmentType, apply_url: e.applyUrl }).eq("id", j.id);
      enrichedCount++;
    } catch { await db.from("jobs").update({ description_text: "" }).eq("id", j.id); }
  }
  // (b) realtime: only triage-yes jobs first seen in the last 2 hours, so a new posting is in the feed within minutes.
  //     Everything older waits for the batch (half price).
  spent = await pipelineSpentToday(db as never).catch(() => spent);
  const fresh = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { data: jobs, error } = spent >= budget ? { data: [], error: null } : await db.from("jobs").select("id,title,location,description_text,companies(name)")
    .is("tagged_at", null).is("closed_at", null).is("tag_batch_id", null).eq("triage", "yes").gte("first_seen_at", fresh)
    .not("description_text", "is", null).neq("description_text", "").order("first_seen_at", { ascending: false }).limit(tagN);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let tagged = 0, failed = 0; let firstError: string | null = null;
  const one = async (j: NonNullable<typeof jobs>[number]) => {
    try {
      const company = (j as unknown as { companies: { name: string } | null }).companies?.name ?? "";
      const tags = await tagJob({ title: j.title, company, location: j.location, descriptionText: j.description_text! });
      await applyTags(db, j.id, tags);
      tagged++;
    } catch (e) { failed++; firstError ??= String((e as Error).message).slice(0, 300); }
  };
  for (let i = 0; i < (jobs ?? []).length && Date.now() - started < budgetMs; i += 6) {
    await Promise.all(jobs!.slice(i, i + 6).map(one));
  }
  return NextResponse.json({ collected, pretagged, triaged: { yes: triagedYes, no: triagedNo, error: triageError }, enriched: enrichedCount, tagged, failed, firstError,
    spentTodayUsd: Number(spent.toFixed(4)), budgetUsd: budget, ms: Date.now() - started });
}
