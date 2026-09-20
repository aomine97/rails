// Jobvite hosted careers pages have no public JSON; the listing and job pages are stable HTML.
// List: https://jobs.jobvite.com/{slug}/jobs   Job: https://jobs.jobvite.com/{slug}/job/{id}
import type { Adapter, CompanyRef, FetchLike, FetchOpts, RawJob } from "./types";
import { AdapterError } from "./types";
import { htmlToText, isRemote, listOnly, maxJobs, UA } from "./util";

async function getHtml(company: string, url: string, fetchImpl: FetchLike): Promise<string> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20_000), headers: { accept: "text/html", "user-agent": UA } });
  if (!res.ok) throw new AdapterError("jobvite", company, `GET ${url} -> ${res.status}`, res.status);
  return res.text();
}

/** Exported for tests: parse the listing HTML into (id, title, location). */
export function parseJobviteList(slug: string, html: string): { id: string; title: string; location: string | null }[] {
  const out: { id: string; title: string; location: string | null }[] = [];
  const seen = new Set<string>();
  const re = new RegExp(`<a[^>]+href=["'](?:https?://jobs\\.jobvite\\.com)?/${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/job/([A-Za-z0-9]+)[^"']*["'][^>]*>([\\s\\S]*?)</a>([\\s\\S]{0,600}?)(?=<a[^>]+href=|$)`, "gi");
  for (const m of html.matchAll(re)) {
    const id = m[1]; if (seen.has(id)) continue; seen.add(id);
    // Modern Jobvite pages wrap the whole card in the anchor: title, "2 Locations", department, "Job listing"/"Job location" labels.
    const lines = (htmlToText(m[2].replace(/<\/(?:span|td|th|p|li|div|h[1-6])>/gi, "$&\n")) ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !/^job (listing|location|category|department)$/i.test(l));
    const title = lines[0] ?? ""; if (!title) continue;
    const inCard = lines.slice(1).find((l) => /^\d+ locations?$/i.test(l) || /remote|,\s*[A-Z]{2}\b|\b(United States|USA|Canada|UK)\b/i.test(l)) ?? null;
    const outside = m[3].match(/jv-job-list-location[^>]*>([\s\S]*?)<\/(?:div|td|span)>/i)?.[1];
    out.push({ id, title, location: inCard ?? (htmlToText(outside ?? "") || null) });
  }
  return out;
}

export function parseJobviteDetail(html: string): { html: string | null; text: string | null } {
  const block = html.match(/<div[^>]+class=["'][^"']*jv-job-detail-description[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]+class=["'][^"']*jv-job-detail-(?:meta|apply)|<footer|$)/i)?.[1]
    ?? html.match(/<div[^>]+class=["'][^"']*jv-job-detail[^"']*["'][^>]*>([\s\S]*?)<\/section>/i)?.[1] ?? null;
  return { html: block, text: htmlToText(block) };
}

export const jobvite: Adapter = {
  kind: "jobvite",
  async enrich(c: CompanyRef, job: RawJob, fetchImpl: FetchLike = fetch) {
    const d = parseJobviteDetail(await getHtml(c.name, job.url, fetchImpl));
    return { ...job, descriptionHtml: d.html ?? job.descriptionHtml, descriptionText: d.text ?? job.descriptionText };
  },
  async fetchJobs(c: CompanyRef, fetchImpl: FetchLike = fetch, opts?: FetchOpts): Promise<RawJob[]> {
    if (!c.slug) return [];
    const html = await getHtml(c.name, `https://jobs.jobvite.com/${c.slug}/jobs`, fetchImpl);
    const out: RawJob[] = [];
    for (const j of parseJobviteList(c.slug, html)) {
      if (out.length >= maxJobs(opts)) break;
      const url = `https://jobs.jobvite.com/${c.slug}/job/${j.id}`;
      let row: RawJob = { ats: "jobvite", companySlug: c.slug, externalId: j.id, title: j.title, location: j.location, remote: isRemote(j.location), employmentType: null, department: null, descriptionHtml: null, descriptionText: null, url, applyUrl: `${url}/apply`, postedAt: null, pay: null };
      if (!listOnly(opts)) try { row = await jobvite.enrich!(c, row, fetchImpl); } catch { /* keep list row */ }
      out.push(row);
    }
    return out;
  },
};
