// SmartRecruiters Posting API (public): https://developers.smartrecruiters.com/docs/posting-api
import type { Adapter, CompanyRef, FetchLike, FetchOpts, RawJob } from "./types";
import { getJson, htmlToText, isRemote, toIso } from "./util";

interface SrPosting {
  id: string; name: string; releasedDate?: string; ref: string;
  location?: { city?: string; region?: string; country?: string; remote?: boolean };
  typeOfEmployment?: { label?: string }; department?: { label?: string };
}
interface SrDetail { applyUrl?: string; postingUrl?: string; jobAd?: { sections?: Record<string, { title?: string; text?: string }> } }

function applyDetail(j: RawJob, d: SrDetail): RawJob {
  const html = Object.values(d.jobAd?.sections ?? {}).map((s) => `<h3>${s.title ?? ""}</h3>${s.text ?? ""}`).join("");
  return { ...j, descriptionHtml: html || j.descriptionHtml, descriptionText: htmlToText(html) ?? j.descriptionText, url: d.postingUrl ?? j.url, applyUrl: d.applyUrl ?? d.postingUrl ?? j.applyUrl };
}

export const smartrecruiters: Adapter = {
  kind: "smartrecruiters",
  async enrich(c: CompanyRef, job: RawJob, fetchImpl: FetchLike = fetch): Promise<RawJob> {
    const d = await getJson<SrDetail>("smartrecruiters", c.name, `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(c.slug!)}/postings/${job.externalId}`, fetchImpl);
    return applyDetail(job, d);
  },
  async fetchJobs(c: CompanyRef, fetchImpl: FetchLike = fetch, opts?: FetchOpts): Promise<RawJob[]> {
    if (!c.slug) return [];
    const out: RawJob[] = [];
    for (let offset = 0; offset < 2000; offset += 100) {
      const page = await getJson<{ totalFound: number; content: SrPosting[] }>("smartrecruiters", c.name, `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(c.slug)}/postings?limit=100&offset=${offset}`, fetchImpl);
      for (const p of page.content ?? []) {
        let detail: SrDetail = {};
        try { detail = await getJson<SrDetail>("smartrecruiters", c.name, p.ref, fetchImpl); } catch { /* list row still usable */ }
        const html = Object.values(detail.jobAd?.sections ?? {}).map((s) => `<h3>${s.title ?? ""}</h3>${s.text ?? ""}`).join("");
        const loc = [p.location?.city, p.location?.region, p.location?.country].filter(Boolean).join(", ") || null;
        const url = detail.postingUrl ?? `https://jobs.smartrecruiters.com/${c.slug}/${p.id}`;
        out.push({
          ats: "smartrecruiters", companySlug: c.slug!, externalId: p.id, title: p.name,
          location: loc, remote: p.location?.remote ?? isRemote(loc),
          employmentType: p.typeOfEmployment?.label ?? null, department: p.department?.label ?? null,
          descriptionHtml: html || null, descriptionText: htmlToText(html),
          url, applyUrl: detail.applyUrl ?? url, postedAt: toIso(p.releasedDate), pay: null,
        });
      }
      if (!page.content || page.content.length < 100 || offset + 100 >= (page.totalFound ?? 0)) break;
    }
    return out;
  },
};
