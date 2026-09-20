// Oracle Recruiting Cloud (Fusion HCM) candidate-experience REST, unauthenticated:
// list:   {host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber={site},limit=100,offset={n},sortBy=POSTING_DATES_DESC
// detail: {host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id="{id}",siteNumber={site}
// company.careersUrl = https://{host}; company.slug = site number (defaults to CX_1).
import type { Adapter, CompanyRef, FetchLike, FetchOpts, RawJob } from "./types";
import { getJson, htmlToText, isRemote, listOnly, maxJobs, toIso } from "./util";

interface OrcReq { Id: string; Title: string; PostedDate?: string; PrimaryLocation?: string; ShortDescriptionStr?: string; WorkplaceType?: string; JobFamily?: string; secondaryLocations?: { Name?: string }[]; ExternalQualificationsStr?: string; ExternalResponsibilitiesStr?: string; ExternalDescriptionStr?: string; WorkerType?: string }
interface OrcList { items?: { requisitionList?: OrcReq[]; TotalJobsCount?: number }[] }
interface OrcDetail { items?: OrcReq[] }

const host = (c: CompanyRef) => (c.careersUrl ?? "").replace(/\/+$/, "");
const site = (c: CompanyRef) => c.slug && /^CX_\d+$/i.test(c.slug) ? c.slug : "CX_1";
const jobUrl = (c: CompanyRef, id: string) => `${host(c)}/hcmUI/CandidateExperience/en/sites/${site(c)}/job/${id}`;

function detailHtml(r: OrcReq): string {
  return [r.ExternalDescriptionStr, r.ExternalResponsibilitiesStr ? `<h3>Responsibilities</h3>${r.ExternalResponsibilitiesStr}` : "", r.ExternalQualificationsStr ? `<h3>Qualifications</h3>${r.ExternalQualificationsStr}` : ""].filter(Boolean).join("");
}

export const oracle: Adapter = {
  kind: "oracle",
  async enrich(c: CompanyRef, job: RawJob, fetchImpl: FetchLike = fetch) {
    const url = `${host(c)}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id="${encodeURIComponent(job.externalId)}",siteNumber=${site(c)}`;
    const d = await getJson<OrcDetail>("oracle", c.name, url, fetchImpl);
    const r = d.items?.[0]; if (!r) return job;
    const html = detailHtml(r);
    return { ...job, descriptionHtml: html || job.descriptionHtml, descriptionText: htmlToText(html) ?? job.descriptionText, employmentType: r.WorkerType ?? job.employmentType };
  },
  async fetchJobs(c: CompanyRef, fetchImpl: FetchLike = fetch, opts?: FetchOpts): Promise<RawJob[]> {
    if (!host(c)) return [];
    const out: RawJob[] = [];
    for (let offset = 0; offset < 3000; offset += 100) {
      const url = `${host(c)}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${site(c)},limit=100,offset=${offset},sortBy=POSTING_DATES_DESC`;
      const data = await getJson<OrcList>("oracle", c.name, url, fetchImpl);
      const rows = data.items?.[0]?.requisitionList ?? [];
      for (const r of rows) {
        if (out.length >= maxJobs(opts)) return out;
        const loc = r.PrimaryLocation ?? r.secondaryLocations?.[0]?.Name ?? null;
        const summary = htmlToText(r.ShortDescriptionStr ?? "");
        let row: RawJob = {
          ats: "oracle", companySlug: site(c), externalId: String(r.Id), title: r.Title, location: loc,
          remote: r.WorkplaceType ? /remote/i.test(r.WorkplaceType) : isRemote(loc), employmentType: r.WorkerType ?? null, department: r.JobFamily ?? null,
          descriptionHtml: r.ShortDescriptionStr ?? null, descriptionText: summary || null, url: jobUrl(c, String(r.Id)), applyUrl: jobUrl(c, String(r.Id)), postedAt: toIso(r.PostedDate), pay: null,
        };
        if (!listOnly(opts)) try { row = await oracle.enrich!(c, row, fetchImpl); } catch { /* keep summary */ }
        out.push(row);
      }
      if (rows.length < 100) break;
    }
    return out;
  },
};
