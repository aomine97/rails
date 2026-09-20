// iCIMS hosted careers portals: HTML search pages (paged by pr=) and job pages that carry schema.org JobPosting JSON-LD.
// List: https://{slug}.icims.com/jobs/search?ss=1&pr={n}&in_iframe=1   Job: https://{slug}.icims.com/jobs/{id}/{title-slug}/job?in_iframe=1
import type { Adapter, CompanyRef, FetchLike, FetchOpts, RawJob } from "./types";
import { AdapterError } from "./types";
import { htmlToText, isRemote, listOnly, maxJobs, toIso, UA } from "./util";

async function getHtml(company: string, url: string, fetchImpl: FetchLike): Promise<string> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20_000), headers: { accept: "text/html", "user-agent": UA } });
  if (!res.ok) throw new AdapterError("icims", company, `GET ${url} -> ${res.status}`, res.status);
  return res.text();
}

export function parseIcimsList(html: string): { id: string; url: string; title: string; location: string | null; posted: string | null }[] {
  const out: ReturnType<typeof parseIcimsList> = []; const seen = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+\/jobs\/(\d+)\/[^"'?]+\/job)[^"']*["'][^>]*>([\s\S]*?)<\/a>([\s\S]{0,1500}?)(?=<a[^>]+href=["']https?:\/\/[^"']+\/jobs\/\d+\/|$)/gi)) {
    const id = m[2]; if (seen.has(id)) continue; seen.add(id);
    const title = htmlToText(m[3].match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1] ?? m[3]) ?? "";
    if (!title) continue;
    const after = m[4];
    const loc = after.match(/Job Locations?<\/[^>]+>\s*(?:<[^>]+>\s*)*([^<]{2,120})</i)?.[1] ?? after.match(/class=["'][^"']*location[^"']*["'][^>]*>\s*(?:<[^>]+>\s*)*([^<]{2,120})</i)?.[1];
    const posted = after.match(/Posted Date<\/[^>]+>\s*(?:<[^>]+>\s*)*([^<]{4,40})</i)?.[1];
    out.push({ id, url: m[1], title, location: htmlToText(loc ?? "") || null, posted: posted ? toIso((posted.match(/\(([^)]+)\)/)?.[1] ?? posted).trim()) : null });
  }
  return out;
}

/** Job page: JSON-LD JobPosting first, then the iCIMS description container. */
export function parseIcimsDetail(html: string): { html: string | null; text: string | null; title?: string; location?: string | null; posted?: string | null; employmentType?: string | null } {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(m[1]); const list = Array.isArray(d) ? d : d["@graph"] ?? [d];
      const jp = list.find((x: { "@type"?: string }) => x?.["@type"] === "JobPosting");
      if (jp?.description) {
        const a = jp.jobLocation?.address ?? jp.jobLocation?.[0]?.address;
        const loc = a ? [a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(", ") : null;
        return { html: jp.description, text: htmlToText(jp.description), title: jp.title, location: loc || null, posted: toIso(jp.datePosted), employmentType: Array.isArray(jp.employmentType) ? jp.employmentType[0] : jp.employmentType ?? null };
      }
    } catch { /* next */ }
  }
  const block = html.match(/<div[^>]+class=["'][^"']*iCIMS_InfoMsg_Job[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? html.match(/<div[^>]+class=["'][^"']*iCIMS_JobContent[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? null;
  return { html: block, text: htmlToText(block) };
}

export const icims: Adapter = {
  kind: "icims",
  async enrich(c: CompanyRef, job: RawJob, fetchImpl: FetchLike = fetch) {
    const d = parseIcimsDetail(await getHtml(c.name, `${job.url}?in_iframe=1`, fetchImpl));
    return { ...job, descriptionHtml: d.html ?? job.descriptionHtml, descriptionText: d.text ?? job.descriptionText, title: d.title ?? job.title, location: d.location ?? job.location, postedAt: d.posted ?? job.postedAt, employmentType: d.employmentType ?? job.employmentType };
  },
  async fetchJobs(c: CompanyRef, fetchImpl: FetchLike = fetch, opts?: FetchOpts): Promise<RawJob[]> {
    if (!c.slug) return [];
    const out: RawJob[] = [];
    for (let pr = 0; pr < 40; pr++) {
      const html = await getHtml(c.name, `https://${c.slug}.icims.com/jobs/search?ss=1&pr=${pr}&in_iframe=1`, fetchImpl);
      const rows = parseIcimsList(html);
      if (rows.length === 0) break;
      for (const j of rows) {
        if (out.length >= maxJobs(opts)) return out;
        let row: RawJob = { ats: "icims", companySlug: c.slug, externalId: j.id, title: j.title, location: j.location, remote: isRemote(j.location), employmentType: null, department: null, descriptionHtml: null, descriptionText: null, url: j.url, applyUrl: `${j.url}?mode=apply`, postedAt: j.posted, pay: null };
        if (!listOnly(opts)) try { row = await icims.enrich!(c, row, fetchImpl); } catch { /* keep list row */ }
        out.push(row);
      }
      if (!/pr=\d+[^"']*["'][^>]*>\s*(?:<[^>]+>\s*)*(?:Next|›|&raquo;)/i.test(html) && rows.length < 20) break;
    }
    return out;
  },
};
