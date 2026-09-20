// Workable public careers-page API (no key): POST https://apply.workable.com/api/v3/accounts/{slug}/jobs
// Detail: GET https://apply.workable.com/api/v2/accounts/{slug}/jobs/{shortcode}
import type { Adapter, CompanyRef, FetchLike, FetchOpts, RawJob } from "./types";
import { getJson, htmlToText, isRemote, listOnly, maxJobs, toIso, UA } from "./util";

interface WkJob {
  id?: number | string; shortcode: string; title: string; published?: string; url?: string;
  location?: { city?: string; region?: string; country?: string; workplaceType?: string; countryCode?: string };
  locations?: { city?: string; region?: string; country?: string }[];
  remote?: boolean; workplace?: string; department?: string; type?: string; employmentType?: string;
}
interface WkList { results?: WkJob[]; jobs?: WkJob[]; nextPage?: string | null; paging?: { next?: string } }
interface WkDetail { description?: string; requirements?: string; benefits?: string; title?: string; url?: string; location?: WkJob["location"]; employment_type?: string; department?: string }

const locOf = (j: WkJob) => {
  const l = j.location ?? j.locations?.[0];
  return [l?.city, l?.region, l?.country].filter(Boolean).join(", ") || null;
};
const jobUrl = (slug: string, j: WkJob) => j.url ?? `https://apply.workable.com/${slug}/j/${j.shortcode}/`;

function applyDetail(j: RawJob, d: WkDetail): RawJob {
  const html = [d.description, d.requirements ? `<h3>Requirements</h3>${d.requirements}` : "", d.benefits ? `<h3>Benefits</h3>${d.benefits}` : ""].filter(Boolean).join("");
  return { ...j, descriptionHtml: html || j.descriptionHtml, descriptionText: htmlToText(html) ?? j.descriptionText, employmentType: d.employment_type ?? j.employmentType, department: d.department ?? j.department };
}

export const workable: Adapter = {
  kind: "workable",
  async enrich(c: CompanyRef, job: RawJob, fetchImpl: FetchLike = fetch) {
    const d = await getJson<WkDetail>("workable", c.name, `https://apply.workable.com/api/v2/accounts/${encodeURIComponent(c.slug!)}/jobs/${encodeURIComponent(job.externalId)}`, fetchImpl);
    return applyDetail(job, d);
  },
  async fetchJobs(c: CompanyRef, fetchImpl: FetchLike = fetch, opts?: FetchOpts): Promise<RawJob[]> {
    if (!c.slug) return [];
    const out: RawJob[] = [];
    let token: string | null | undefined = null;
    for (let page = 0; page < 30; page++) {
      const body: string = JSON.stringify({ query: "", location: [], department: [], worktype: [], remote: [], ...(token ? { token } : {}) });
      const data: WkList = await getJson<WkList>("workable", c.name, `https://apply.workable.com/api/v3/accounts/${encodeURIComponent(c.slug)}/jobs`, fetchImpl,
        { method: "POST", body, headers: { "content-type": "application/json", "user-agent": UA } });
      const rows = data.results ?? data.jobs ?? [];
      for (const j of rows) {
        if (out.length >= maxJobs(opts)) return out;
        const loc = locOf(j);
        const wp = (j.location?.workplaceType ?? j.workplace ?? "").toLowerCase();
        let row: RawJob = {
          ats: "workable", companySlug: c.slug, externalId: j.shortcode, title: j.title, location: loc,
          remote: j.remote ?? (wp ? wp === "remote" : isRemote(loc)),
          employmentType: j.type ?? j.employmentType ?? null, department: j.department ?? null,
          descriptionHtml: null, descriptionText: null, url: jobUrl(c.slug, j), applyUrl: jobUrl(c.slug, j), postedAt: toIso(j.published), pay: null,
        };
        if (!listOnly(opts)) try { row = await workable.enrich!(c, row, fetchImpl); } catch { /* list row still usable */ }
        out.push(row);
      }
      token = data.nextPage ?? data.paging?.next ?? null;
      if (!token || rows.length === 0) break;
    }
    return out;
  },
};
