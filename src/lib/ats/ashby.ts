// Ashby Job Posting API (public): https://developers.ashbyhq.com/reference/jobpostinglist
import type { Adapter, CompanyRef, FetchLike, RawJob } from "./types";
import { getJson, htmlToText, toIso } from "./util";

interface AshbyJob {
  id: string; title: string; department?: string; team?: string; employmentType?: string;
  location?: string; isRemote?: boolean; publishedAt?: string; jobUrl: string; applyUrl?: string;
  descriptionHtml?: string; descriptionPlain?: string;
  compensation?: { compensationTierSummary?: string; summaryComponents?: { compensationType: string; minValue?: number; maxValue?: number; currencyCode?: string; interval?: string }[] };
}

export const ashby: Adapter = {
  kind: "ashby",
  async fetchJobs(c: CompanyRef, fetchImpl: FetchLike = fetch): Promise<RawJob[]> {
    if (!c.slug) return [];
    const data = await getJson<{ jobs: AshbyJob[] }>("ashby", c.name, `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(c.slug)}?includeCompensation=true`, fetchImpl);
    return (data.jobs ?? []).map((j) => {
      const sal = j.compensation?.summaryComponents?.find((s) => s.compensationType === "Salary");
      return {
        ats: "ashby", companySlug: c.slug!, externalId: j.id, title: j.title,
        location: j.location ?? null, remote: j.isRemote ?? null,
        employmentType: j.employmentType ?? null, department: j.department ?? j.team ?? null,
        descriptionHtml: j.descriptionHtml ?? null, descriptionText: j.descriptionPlain ?? htmlToText(j.descriptionHtml),
        url: j.jobUrl, applyUrl: j.applyUrl ?? j.jobUrl, postedAt: toIso(j.publishedAt),
        pay: sal ? { min: sal.minValue ?? null, max: sal.maxValue ?? null, currency: sal.currencyCode ?? null, period: /hour/i.test(sal.interval ?? "") ? "hour" : "year" } : null,
      };
    });
  },
};
