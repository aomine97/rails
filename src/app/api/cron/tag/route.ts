import { NextResponse } from "next/server";
import { cronAuth } from "../_auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tagJob } from "@/lib/jobs/tagger";
import { adapters, type RawJob } from "@/lib/ats";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Every 15 min. (a) fills in descriptions the poller skipped, (b) tags untagged open jobs and writes job_skills. */
export async function GET(req: Request) {
  const denied = cronAuth(req); if (denied) return denied;
  const db = supabaseAdmin();
  const started = Date.now();
  const budgetMs = 200_000; // stay well under maxDuration
  const url = new URL(req.url);
  const enrichN = Number(url.searchParams.get("enrich") ?? 24), tagN = Number(url.searchParams.get("tag") ?? 24);
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
    .is("tagged_at", null).is("closed_at", null).not("description_text", "is", null).neq("description_text", "").order("first_seen_at", { ascending: false }).limit(tagN);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let tagged = 0, failed = 0; let firstError: string | null = null;
  const one = async (j: NonNullable<typeof jobs>[number]) => {
    try {
      const company = (j as unknown as { companies: { name: string } | null }).companies?.name ?? "";
      const tags = await tagJob({ title: j.title, company, location: j.location, descriptionText: j.description_text! });
      await db.from("jobs").update({ tags, tagged_at: new Date().toISOString(), remote: tags.remote === "unknown" ? undefined : tags.remote === "remote" }).eq("id", j.id);
      const skills = [...tags.requiredSkills.map((k) => ({ job_id: j.id, skill_key: k, required: true })), ...tags.preferredSkills.map((k) => ({ job_id: j.id, skill_key: k, required: false }))];
      if (skills.length) await db.from("job_skills").upsert(skills, { onConflict: "job_id,skill_key" });
      tagged++;
    } catch (e) { failed++; firstError ??= String((e as Error).message).slice(0, 300); }
  };
  for (let i = 0; i < (jobs ?? []).length && Date.now() - started < budgetMs; i += 4) {
    await Promise.all(jobs!.slice(i, i + 4).map(one));
  }
  return NextResponse.json({ enriched: enrichedCount, tagged, failed, firstError, ms: Date.now() - started });
}
