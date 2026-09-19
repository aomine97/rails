// Greenhouse Job Board API (public, no key): https://developers.greenhouse.io/job-board.html
import type { Adapter, CompanyRef, FetchLike, RawJob } from "./types";
import { getJson, htmlToText, isRemote, toIso, unescapeHtml } from "./util";

interface GhJob {
  id: number; title: string; updated_at: string; absolute_url: string; content?: string;
  location?: { name?: string }; departments?: { name: string }[]; offices?: { name: string }[];
  metadata?: { name: string; value: unknown }[];
}

export const greenhouse: Adapter = {
  kind: "greenhouse",
  async fetchJobs(c: CompanyRef, fetchImpl: FetchLike = fetch): Promise<RawJob[]> {
    if (!c.slug) return [];
    const data = await getJson<{ jobs: GhJob[] }>("greenhouse", c.name, `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(c.slug)}/jobs?content=true`, fetchImpl);
    return (data.jobs ?? []).map((j) => {
      const html = unescapeHtml(j.content);
      return {
        ats: "greenhouse", companySlug: c.slug!, externalId: String(j.id), title: j.title,
        location: j.location?.name ?? j.offices?.[0]?.name ?? null,
        remote: isRemote(j.location?.name),
        employmentType: null, department: j.departments?.[0]?.name ?? null,
        descriptionHtml: html, descriptionText: htmlToText(html),
        url: j.absolute_url, applyUrl: j.absolute_url,
        postedAt: toIso(j.updated_at), pay: null,
      };
    });
  },
};
