import type { CanonicalProfile } from "../schemas/profile";
import { JobTags } from "../jobs/tags";
import { scoreJob, type Score } from "./score";
import { nearMatcher, regionOf, type Region } from "./region";
import { countryOf, currencyFor, formatPay } from "./country";

export interface FeedJobRow {
  id: string; title: string; location: string | null; remote: boolean | null; url: string; apply_url: string;
  posted_at: string | null; first_seen_at: string; tags: unknown; pay_min: number | null; pay_max: number | null; pay_period: string | null; pay_currency?: string | null;
  description_text?: string | null;
  source?: string;
  companies: { name: string; ats: string; domain?: string | null; logo_url?: string | null } | null;
}

export interface FeedFilters {
  field?: string | null;          // software | data | cloud | it_support | cyber | product
  level?: string | null;          // internship | new_grad | entry | mid | senior
  /** where: near (the user's own locations) | us | remote | anywhere | an ISO-2 country code (CA, GB, IN, DE...). Default us = US + remote. */
  where?: string | null;
  q?: string | null;
  minFit?: number;
  sort?: "fit" | "new" | null;
}

export interface FeedItem { job: FeedJobRow; tags: JobTags; score: Score; isNew: boolean; ageDays: number | null; region: Region; otherLocations: string[] }

const LEVEL_TO_TYPE: Record<string, CanonicalProfile["constraints"]["employmentTypes"][number]> = {
  internship: "internship", new_grad: "new_grad", entry: "entry", mid: "mid", senior: "senior", unknown: "entry",
};

/** Pure: profile + rows -> ranked feed. Excludes mid/senior and roles the user isn't looking for; scores the rest. */
export function buildFeed(profile: CanonicalProfile, rows: FeedJobRow[], f: FeedFilters = {}, now = new Date()): { items: FeedItem[]; total: number; newToday: number } {
  const wants = new Set(profile.constraints.employmentTypes);
  const near = nearMatcher(profile.constraints.locations);
  const items: FeedItem[] = [];
  const q = f.q?.trim().toLowerCase();
  for (const job of rows) {
    const t = JobTags.safeParse(job.tags); if (!t.success) continue;
    const tags = t.data;
    const type = LEVEL_TO_TYPE[tags.level];
    if (wants.size && !wants.has(type) && !(tags.employmentType === "part_time" && wants.has("part_time")) && !(tags.employmentType === "contract" && wants.has("contract"))) continue;
    if (f.field && tags.field !== f.field) continue;
    if (f.level && tags.level !== f.level) continue;
    const region = regionOf(job.location, tags.country, job.remote ?? (tags.remote === "remote"));
    const where = f.where ?? "us";
    if (where === "near" && region !== "remote" && !(near ? near(job.location) : region === "dmv")) continue;
    if (where === "us" && (region === "intl")) continue;
    if (where === "remote" && region !== "remote") continue;
    if (/^[A-Z]{2}$/.test(where) && where !== "US") { const cc = countryOf(job.location, tags.country); if (cc !== where && !(region === "remote" && cc === "REMOTE")) continue; }
    if (q && !(job.title.toLowerCase().includes(q) || (job.companies?.name ?? "").toLowerCase().includes(q) || (job.location ?? "").toLowerCase().includes(q))) continue;
    const score = scoreJob(profile, tags, { title: job.title, location: job.location });
    if (f.minFit && score.fit < f.minFit) continue;
    const seen = new Date(job.first_seen_at).getTime();
    const posted = job.posted_at ? new Date(job.posted_at).getTime() : null;
    items.push({ job, tags, score, isNew: now.getTime() - seen < 24 * 3600_000, ageDays: posted ? Math.max(0, Math.floor((now.getTime() - posted) / 86_400_000)) : null, region, otherLocations: [] });
  }
  // Same title at the same company posted in several cities: one card, other cities listed.
  const byKey = new Map<string, FeedItem>();
  for (const it of items) {
    const key = `${(it.job.companies?.name ?? "").toLowerCase()}|${it.job.title.toLowerCase().replace(/[,(].*$/, "").trim()}`;
    const cur = byKey.get(key);
    if (!cur) { byKey.set(key, it); continue; }
    const nearIt = near ? near(it.job.location) : it.region === "dmv", nearCur = near ? near(cur.job.location) : cur.region === "dmv";
    const keep = nearIt && !nearCur ? it : it.score.fit > cur.score.fit ? it : cur;
    const drop = keep === it ? cur : it;
    keep.otherLocations = [...cur.otherLocations, ...(drop.job.location ? [drop.job.location] : [])].filter((l) => l !== keep.job.location).slice(0, 6);
    byKey.set(key, keep);
  }
  const deduped = [...byKey.values()];
  if (f.sort === "new") deduped.sort((a, b) => (b.job.posted_at ?? b.job.first_seen_at).localeCompare(a.job.posted_at ?? a.job.first_seen_at));
  else deduped.sort((a, b) => b.score.fit - a.score.fit || (b.job.posted_at ?? "").localeCompare(a.job.posted_at ?? ""));
  return { items: deduped, total: deduped.length, newToday: deduped.filter((i) => i.isNew).length };
}

export const ageLabel = (d: number | null) => d == null ? "" : d === 0 ? "today" : d === 1 ? "1 day ago" : d < 30 ? `${d} days ago` : "30+ days ago";
export const payLabel = (t: JobTags, row: FeedJobRow) => {
  const country = countryOf(row.location, t.country);
  const cur = currencyFor(country === "REMOTE" || country === "unknown" ? "US" : country, row.pay_currency);
  if (t.payMinHourly || t.payMaxHourly) return formatPay(t.payMinHourly, t.payMaxHourly, cur, "hour");
  if (row.pay_min || row.pay_max) return formatPay(row.pay_min, row.pay_max, cur, row.pay_period === "hour" ? "hour" : "year");
  return null;
};
