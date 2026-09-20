// Workday external career sites. Undocumented but stable JSON used by the site itself:
//   POST https://{tenant}.wd{n}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs   {appliedFacets:{}, limit, offset, searchText}
//   GET  https://{tenant}.wd{n}.myworkdayjobs.com/wday/cxs/{tenant}/{site}{externalPath}
// Poll politely: one list call + one detail call per new posting, and never more than once an hour per company.
import type { Adapter, CompanyRef, FetchLike, FetchOpts, RawJob } from "./types";
import { AdapterError } from "./types";
import { getJson, htmlToText, isRemote, listOnly, maxJobs } from "./util";

interface WdList { total: number; jobPostings: { title: string; externalPath: string; locationsText?: string; postedOn?: string; bulletFields?: string[] }[] }
interface WdDetail { jobPostingInfo?: { title?: string; jobDescription?: string; location?: string; additionalLocations?: string[]; postedOn?: string; startDate?: string; timeType?: string; jobReqId?: string; externalUrl?: string; remoteType?: string } }

/** "Posted 3 Days Ago" / "Posted Today" / "Posted 30+ Days Ago" -> ISO date (approximate). */
export function parsePostedOn(s: string | undefined, now = new Date()): string | null {
  if (!s) return null;
  const t = s.toLowerCase();
  const d = new Date(now);
  if (t.includes("today")) return d.toISOString();
  if (t.includes("yesterday")) { d.setDate(d.getDate() - 1); return d.toISOString(); }
  const m = t.match(/(\d+)\+?\s*day/);
  if (m) { d.setDate(d.getDate() - Number(m[1])); return d.toISOString(); }
  return null;
}

const baseOf = (c: CompanyRef) => `https://${c.tenant}.wd${c.wdn}.myworkdayjobs.com/wday/cxs/${c.tenant}/${c.slug}`;

async function detail(c: CompanyRef, externalPath: string, fetchImpl: FetchLike): Promise<WdDetail["jobPostingInfo"]> {
  return (await getJson<WdDetail>("workday", c.name, `${baseOf(c)}${externalPath}`, fetchImpl)).jobPostingInfo ?? {};
}

export const workday: Adapter = {
  kind: "workday",
  async enrich(c: CompanyRef, job: RawJob, fetchImpl: FetchLike = fetch): Promise<RawJob> {
    const path = job.url.split(`/${c.slug}`)[1];
    if (!path) return job;
    const info = await detail(c, path, fetchImpl);
    const html = info?.jobDescription ?? null;
    return { ...job, title: info?.title ?? job.title, location: info?.location ?? job.location, employmentType: info?.timeType ?? job.employmentType,
      externalId: info?.jobReqId ?? job.externalId, descriptionHtml: html, descriptionText: htmlToText(html),
      url: info?.externalUrl ?? job.url, applyUrl: info?.externalUrl ?? job.applyUrl, postedAt: parsePostedOn(info?.postedOn) ?? job.postedAt };
  },
  async fetchJobs(c: CompanyRef, fetchImpl: FetchLike = fetch, opts?: FetchOpts): Promise<RawJob[]> {
    if (!c.slug || !c.tenant || !c.wdn) throw new AdapterError("workday", c.name, "needs slug (site), tenant and wdn");
    const base = baseOf(c);
    const out: RawJob[] = [];
    const limit = 20;
    let total: number | null = null; // some tenants report total only on the first page (NXP: 791, then 0)
    for (let offset = 0; offset < 1000; offset += limit) {
      const list = await getJson<WdList>("workday", c.name, `${base}/jobs`, fetchImpl, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ appliedFacets: {}, limit, offset, searchText: "" }),
      });
      for (const p of list.jobPostings ?? []) {
        if (out.length >= maxJobs(opts)) return out;
        let info: WdDetail["jobPostingInfo"] = {};
        if (!listOnly(opts)) try { info = await detail(c, p.externalPath, fetchImpl); } catch { /* keep list data */ }
        const id = info?.jobReqId ?? p.externalPath.split("_").pop() ?? p.externalPath;
        const html = info?.jobDescription ?? null;
        const publicUrl = info?.externalUrl ?? `https://${c.tenant}.wd${c.wdn}.myworkdayjobs.com/${c.slug}${p.externalPath}`;
        out.push({
          ats: "workday", companySlug: c.slug!, externalId: id, title: info?.title ?? p.title,
          location: info?.location ?? p.locationsText ?? null,
          remote: info?.remoteType ? /remote/i.test(info.remoteType) : isRemote(p.locationsText),
          employmentType: info?.timeType ?? null, department: null,
          descriptionHtml: html, descriptionText: htmlToText(html),
          url: publicUrl, applyUrl: publicUrl, postedAt: parsePostedOn(info?.postedOn ?? p.postedOn), pay: null,
        });
      }
      if (total == null && list.total) total = list.total;
      if (!list.jobPostings || list.jobPostings.length < limit || (total != null && offset + limit >= total)) break;
    }
    return out;
  },
};
