// Lever Postings API (public): https://github.com/lever/postings-api
import type { Adapter, CompanyRef, FetchLike, RawJob } from "./types";
import { getJson, isRemote, toIso } from "./util";

interface LeverPosting {
  id: string; text: string; hostedUrl: string; applyUrl: string; createdAt: number;
  categories?: { location?: string; team?: string; department?: string; commitment?: string; allLocations?: string[] };
  workplaceType?: "remote" | "hybrid" | "on-site" | string;
  description?: string; descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

export const lever: Adapter = {
  kind: "lever",
  async fetchJobs(c: CompanyRef, fetchImpl: FetchLike = fetch): Promise<RawJob[]> {
    if (!c.slug) return [];
    const data = await getJson<LeverPosting[]>("lever", c.name, `https://api.lever.co/v0/postings/${encodeURIComponent(c.slug)}?mode=json`, fetchImpl);
    return (Array.isArray(data) ? data : []).map((j) => {
      const listsHtml = (j.lists ?? []).map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`).join("");
      const html = (j.description ?? "") + listsHtml;
      const listsText = (j.lists ?? []).map((l) => `${l.text}\n${l.content.replace(/<[^>]+>/g, "")}`).join("\n\n");
      return {
        ats: "lever", companySlug: c.slug!, externalId: j.id, title: j.text,
        location: j.categories?.location ?? j.categories?.allLocations?.[0] ?? null,
        remote: j.workplaceType ? j.workplaceType === "remote" : isRemote(j.categories?.location),
        employmentType: j.categories?.commitment ?? null,
        department: j.categories?.team ?? j.categories?.department ?? null,
        descriptionHtml: html || null,
        descriptionText: [j.descriptionPlain, listsText].filter(Boolean).join("\n\n") || null,
        url: j.hostedUrl, applyUrl: j.applyUrl ?? j.hostedUrl,
        postedAt: toIso(j.createdAt),
        pay: j.salaryRange?.min != null || j.salaryRange?.max != null
          ? { min: j.salaryRange?.min ?? null, max: j.salaryRange?.max ?? null, currency: j.salaryRange?.currency ?? null, period: j.salaryRange?.interval === "per-hour-salary" ? "hour" : "year" }
          : null,
      };
    });
  },
};
