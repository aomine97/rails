// USAJOBS Search API: https://developer.usajobs.gov/api-reference/get-api-search  (free key; header Authorization-Key + User-Agent = your email)
import type { Adapter, CompanyRef, FetchLike, RawJob } from "./types";
import { getJson, htmlToText, isRemote, toIso } from "./util";

interface UsaItem {
  MatchedObjectId: string;
  MatchedObjectDescriptor: {
    PositionTitle: string; PositionURI: string; ApplyURI?: string[]; PositionLocationDisplay?: string; OrganizationName?: string;
    PublicationStartDate?: string; PositionSchedule?: { Name: string }[];
    PositionRemuneration?: { MinimumRange?: string; MaximumRange?: string; RateIntervalCode?: string }[];
    QualificationSummary?: string; UserArea?: { Details?: { JobSummary?: string; MajorDuties?: string[]; TeleworkEligible?: boolean; RemoteIndicator?: boolean } };
  };
}

/** `slug` is the keyword query, e.g. "information technology intern pathways". `tenant` unused. */
export const usajobs: Adapter = {
  kind: "usajobs",
  async fetchJobs(c: CompanyRef, fetchImpl: FetchLike = fetch): Promise<RawJob[]> {
    const key = process.env.USAJOBS_API_KEY, email = process.env.USAJOBS_USER_AGENT;
    if (!key || !email) return [];
    const q = encodeURIComponent(c.slug ?? "information technology");
    const data = await getJson<{ SearchResult: { SearchResultItems: UsaItem[] } }>("usajobs", c.name,
      `https://data.usajobs.gov/api/search?Keyword=${q}&ResultsPerPage=500&HiringPath=student;recent-graduates;public`, fetchImpl,
      { headers: { Host: "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key } });
    return (data.SearchResult?.SearchResultItems ?? []).map((it) => {
      const d = it.MatchedObjectDescriptor;
      const rem = d.PositionRemuneration?.[0];
      const det = d.UserArea?.Details;
      const text = [det?.JobSummary, det?.MajorDuties?.join("\n"), d.QualificationSummary].filter(Boolean).join("\n\n");
      return {
        ats: "usajobs", companySlug: c.slug ?? "usajobs", externalId: it.MatchedObjectId, title: d.PositionTitle,
        location: d.PositionLocationDisplay ?? null, remote: det?.RemoteIndicator ?? isRemote(d.PositionLocationDisplay),
        employmentType: d.PositionSchedule?.[0]?.Name ?? null, department: d.OrganizationName ?? null,
        descriptionHtml: null, descriptionText: htmlToText(text),
        url: d.PositionURI, applyUrl: d.ApplyURI?.[0] ?? d.PositionURI, postedAt: toIso(d.PublicationStartDate),
        pay: rem ? { min: Number(rem.MinimumRange) || null, max: Number(rem.MaximumRange) || null, currency: "USD", period: rem.RateIntervalCode === "PH" ? "hour" : "year" } : null,
      };
    });
  },
};
