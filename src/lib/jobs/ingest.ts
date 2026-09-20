import type { SupabaseClient } from "@supabase/supabase-js";
import { adapters, fetchCompanyJobs, type CompanyRef, type RawJob } from "../ats";

export interface CompanyRow { id: string; name: string; ats: CompanyRef["ats"]; slug: string | null; tenant: string | null; wdn: number | null; careers_url: string | null }

export function toJobRow(companyId: string, j: RawJob, now: string) {
  return {
    company_id: companyId, ats: j.ats, external_id: j.externalId, title: j.title, location: j.location, remote: j.remote,
    employment_type: j.employmentType, department: j.department, description_html: j.descriptionHtml, description_text: j.descriptionText,
    url: j.url, apply_url: j.applyUrl, posted_at: j.postedAt,
    pay_min: j.pay?.min ?? null, pay_max: j.pay?.max ?? null, pay_currency: j.pay?.currency ?? null, pay_period: j.pay?.period ?? null,
    last_seen_at: now, closed_at: null,
  };
}

/** Per poll: list up to LIST_CAP postings, fetch details only for postings we have never seen (up to ENRICH_CAP), touch the rest. */
const LIST_CAP = 600, ENRICH_CAP = 40;

/** Poll one company. Returns counts. */
export async function pollCompany(db: SupabaseClient, c: CompanyRow, fetchImpl?: typeof fetch) {
  const now = new Date().toISOString();
  const ref: CompanyRef = { name: c.name, ats: c.ats, slug: c.slug, tenant: c.tenant, wdn: c.wdn };
  let jobs: RawJob[];
  try {
    jobs = await fetchCompanyJobs(ref, fetchImpl, { listOnly: true, maxJobs: LIST_CAP });
  } catch (e) {
    await db.from("companies").update({ last_polled_at: now, last_poll_ok: false, last_error: String((e as Error).message).slice(0, 500) }).eq("id", c.id);
    return { company: c.name, ok: false, listed: 0, inserted: 0, enriched: 0, closed: 0, error: (e as Error).message };
  }
  const { data: existingRows, error: exErr } = await db.from("jobs").select("id,external_id").eq("company_id", c.id);
  if (exErr) throw exErr;
  const existing = new Map((existingRows ?? []).map((r) => [r.external_id as string, r.id as string]));

  // 1. new postings: enrich (details) for the first ENRICH_CAP, insert all
  const fresh = jobs.filter((j) => !existing.has(j.externalId));
  const enrichFn = adapters[c.ats]?.enrich;
  let enriched = 0;
  if (enrichFn) {
    for (let i = 0; i < Math.min(fresh.length, ENRICH_CAP); i += 4) {
      const batch = fresh.slice(i, i + 4);
      const done = await Promise.all(batch.map(async (j) => { try { const e = await enrichFn(ref, j, fetchImpl); enriched++; return e; } catch { return j; } }));
      done.forEach((j, k) => { fresh[i + k] = j; });
    }
  }
  const seenIds = new Set<string>();
  const rows = fresh.filter((j) => (seenIds.has(j.externalId) ? false : seenIds.add(j.externalId))).map((j) => toJobRow(c.id, j, now));
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from("jobs").upsert(rows.slice(i, i + 200), { onConflict: "company_id,external_id" });
    if (error) throw error;
    inserted += Math.min(200, rows.length - i);
  }

  // 2. postings still in the feed: touch last_seen_at (and reopen if we had closed them)
  const seenExistingIds = jobs.map((j) => existing.get(j.externalId)).filter((x): x is string => !!x);
  for (let i = 0; i < seenExistingIds.length; i += 500) {
    await db.from("jobs").update({ last_seen_at: now, closed_at: null }).in("id", seenExistingIds.slice(i, i + 500));
  }

  // 3. feed-sourced postings that vanished from the feed are closed (only when the list was not truncated by LIST_CAP)
  let closed = 0;
  if (jobs.length < LIST_CAP) {
    const { data: closedRows } = await db.from("jobs").update({ closed_at: now })
      .eq("company_id", c.id).eq("source", "feed").is("closed_at", null).lt("last_seen_at", now).select("id");
    closed = closedRows?.length ?? 0;
  }
  await db.from("companies").update({ last_polled_at: now, last_poll_ok: true, last_error: null }).eq("id", c.id);
  return { company: c.name, ok: true, listed: jobs.length, inserted, enriched, pendingDetails: Math.max(0, fresh.length - ENRICH_CAP), closed };
}

/** Companies due for a poll: never polled, or polled more than `minutes` ago, oldest first. */
export async function dueCompanies(db: SupabaseClient, minutes = 60, limit = 50): Promise<CompanyRow[]> {
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data, error } = await db.from("companies").select("id,name,ats,slug,tenant,wdn,careers_url")
    .eq("active", true).not("slug", "is", null).in("ats", ["greenhouse", "lever", "ashby", "smartrecruiters", "workday", "usajobs"])
    .or(`last_polled_at.is.null,last_polled_at.lt.${cutoff}`)
    .order("last_polled_at", { ascending: true, nullsFirst: true }).limit(limit);
  if (error) throw error;
  return (data ?? []) as CompanyRow[];
}
