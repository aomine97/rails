import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCompanyJobs, type CompanyRef, type RawJob } from "../ats";

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

/** Poll one company: fetch feed, upsert rows, close postings that vanished from the feed. Returns counts. */
export async function pollCompany(db: SupabaseClient, c: CompanyRow, fetchImpl?: typeof fetch) {
  const now = new Date().toISOString();
  let jobs: RawJob[];
  try {
    jobs = await fetchCompanyJobs({ name: c.name, ats: c.ats, slug: c.slug, tenant: c.tenant, wdn: c.wdn }, fetchImpl);
  } catch (e) {
    await db.from("companies").update({ last_polled_at: now, last_poll_ok: false, last_error: String((e as Error).message).slice(0, 500) }).eq("id", c.id);
    return { company: c.name, ok: false, upserted: 0, closed: 0, error: (e as Error).message };
  }
  const rows = jobs.map((j) => toJobRow(c.id, j, now));
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { error, count } = await db.from("jobs").upsert(rows.slice(i, i + 200), { onConflict: "company_id,external_id", ignoreDuplicates: false, count: "exact" });
    if (error) throw error;
    upserted += count ?? 0;
  }
  // Anything from this company's feed we did not just see is closed (feed-sourced only; pasted jobs are verified by URL instead)
  const { data: closedRows } = await db.from("jobs").update({ closed_at: now })
    .eq("company_id", c.id).eq("source", "feed").is("closed_at", null).lt("last_seen_at", now).select("id");
  await db.from("companies").update({ last_polled_at: now, last_poll_ok: true, last_error: null }).eq("id", c.id);
  return { company: c.name, ok: true, upserted, closed: closedRows?.length ?? 0 };
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
