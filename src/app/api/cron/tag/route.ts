import { NextResponse } from "next/server";
import { cronAuth } from "../_auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tagJob } from "@/lib/jobs/tagger";
import { pretag } from "@/lib/jobs/tags";
import { adapters, type RawJob } from "@/lib/ats";
import { applyTags } from "@/lib/jobs/apply-tags";
import { collectTagBatches } from "@/lib/jobs/batch";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Every 10 min. (0) collects finished nightly batches, (a) fills in descriptions the poller skipped, (b) tags untagged open jobs online and writes job_skills. */
export async function GET(req: Request) {
  const denied = await cronAuth(req); if (denied) return denied;
  const db = supabaseAdmin();
  const started = Date.now();
  const budgetMs = 200_000; // stay well under maxDuration
  const url = new URL(req.url);
  const enrichN = Number(url.searchParams.get("enrich") ?? 32), tagN = Number(url.searchParams.get("tag") ?? 96);
  const collected = await collectTagBatches(db, 60_000).catch((e) => [{ id: "error", status: String((e as Error).message).slice(0, 200), tagged: 0, failed: 0, done: false }]);
  // (0) pre-tag: titles that are clearly senior/management or clearly not tech get a stub tag with no model call
  const { data: raw } = await db.from("jobs").select("id,title").is("tagged_at", null).is("closed_at", null).order("first_seen_at", { ascending: false }).limit(400);
  let pretagged = 0;
  for (const j of raw ?? []) {
    const t = pretag(j.title);
    if (t) { await db.from("jobs").update({ tags: t, tagged_at: new Date().toISOString() }).eq("id", j.id); pretagged++; }
  }
  // (a) enrich jobs with no description yet (Workday / SmartRecruiters list-only rows)
  const { data: bare } = await db.from("jobs").select("id,ats,external_id,title,location,url,apply_url,companies(name,ats,slug,tenant,wdn)")
    .is("description_text", null).is("closed_at", null).order("first_seen_at", { ascending: false }).limit(enrichN);
  let enrichedCount = 0;
  for (const j of bare ?? []) {
    if (Date.now() - started > budgetMs / 2) break;
    const co = (j as unknown as { companies: { name: string; ats: RawJob["ats"]; slug: string | null; tenant: string | null; wdn: number | null } | null }).companies;
    const fn = co ? adapters[co.ats]?.enrich : undefined;
    if (!co || !fn) { await db.from("jobs").update({ description_text: "" }).eq("id", j.id); continue; } // nothing to fetch; stop retrying
    try {
      const e = await fn({ name: co.name, ats: co.ats, slug: co.slug, tenant: co.tenant, wdn: co.wdn },
        { ats: co.ats, companySlug: co.slug ?? "", externalId: j.external_id, title: j.title, location: j.location, remote: null, employmentType: null, department: null, descriptionHtml: null, descriptionText: null, url: j.url, applyUrl: j.apply_url, postedAt: null, pay: null });
      await db.from("jobs").update({ description_html: e.descriptionHtml, description_text: e.descriptionText ?? "", title: e.title, location: e.location, employment_type: e.employmentType, apply_url: e.applyUrl }).eq("id", j.id);
      enrichedCount++;
    } catch { await db.from("jobs").update({ description_text: "" }).eq("id", j.id); }
  }
  const { data: jobs, error } = await db.from("jobs").select("id,title,location,description_text,companies(name)")
    .is("tagged_at", null).is("closed_at", null).is("tag_batch_id", null).not("description_text", "is", null).neq("description_text", "").order("first_seen_at", { ascending: false }).limit(tagN);
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
  return NextResponse.json({ collected, pretagged, enriched: enrichedCount, tagged, failed, firstError, ms: Date.now() - started });
}
