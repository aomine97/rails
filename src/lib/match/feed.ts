import type { CanonicalProfile } from "../schemas/profile";
import { JobTags } from "../jobs/tags";
import { scoreJob, type Score } from "./score";

export interface FeedJobRow {
  id: string; title: string; location: string | null; remote: boolean | null; url: string; apply_url: string;
  posted_at: string | null; first_seen_at: string; tags: unknown; pay_min: number | null; pay_max: number | null; pay_period: string | null;
  companies: { name: string; ats: string } | null;
}

export interface FeedFilters {
  field?: string | null;          // software | data | cloud | it_support | cyber | product
  level?: string | null;          // internship | new_grad | entry
  remote?: "remote" | "local" | null;
  q?: string | null;
  minFit?: number;
}

export interface FeedItem { job: FeedJobRow; tags: JobTags; score: Score; isNew: boolean; ageDays: number | null }

const LEVEL_TO_TYPE: Record<string, CanonicalProfile["constraints"]["employmentTypes"][number] | null> = {
  internship: "internship", new_grad: "new_grad", entry: "entry", mid: null, senior: null, unknown: "entry",
};

/** Pure: profile + rows -> ranked feed. Excludes mid/senior and roles the user isn't looking for; scores the rest. */
export function buildFeed(profile: CanonicalProfile, rows: FeedJobRow[], f: FeedFilters = {}, now = new Date()): { items: FeedItem[]; total: number; newToday: number } {
  const wants = new Set(profile.constraints.employmentTypes);
  const items: FeedItem[] = [];
  const q = f.q?.trim().toLowerCase();
  for (const job of rows) {
    const t = JobTags.safeParse(job.tags); if (!t.success) continue;
    const tags = t.data;
    const type = LEVEL_TO_TYPE[tags.level];
    if (type === null) continue;                                   // mid / senior: never shown to students
    if (wants.size && !wants.has(type) && !(tags.employmentType === "part_time" && wants.has("part_time")) && !(tags.employmentType === "contract" && wants.has("contract"))) continue;
    if (f.field && tags.field !== f.field) continue;
    if (f.level && tags.level !== f.level) continue;
    if (f.remote === "remote" && tags.remote !== "remote" && job.remote !== true) continue;
    if (f.remote === "local" && (tags.remote === "remote" || job.remote === true)) continue;
    if (q && !(job.title.toLowerCase().includes(q) || (job.companies?.name ?? "").toLowerCase().includes(q) || (job.location ?? "").toLowerCase().includes(q))) continue;
    const score = scoreJob(profile, tags, { title: job.title, location: job.location });
    if (f.minFit && score.fit < f.minFit) continue;
    const seen = new Date(job.first_seen_at).getTime();
    const posted = job.posted_at ? new Date(job.posted_at).getTime() : null;
    items.push({ job, tags, score, isNew: now.getTime() - seen < 24 * 3600_000, ageDays: posted ? Math.max(0, Math.floor((now.getTime() - posted) / 86_400_000)) : null });
  }
  items.sort((a, b) => b.score.fit - a.score.fit || (b.job.posted_at ?? "").localeCompare(a.job.posted_at ?? ""));
  return { items, total: items.length, newToday: items.filter((i) => i.isNew).length };
}

export const ageLabel = (d: number | null) => d == null ? "" : d === 0 ? "today" : d === 1 ? "1 day ago" : d < 30 ? `${d} days ago` : "30+ days ago";
export const payLabel = (t: JobTags, row: FeedJobRow) => {
  if (t.payMinHourly || t.payMaxHourly) return `$${Math.round(t.payMinHourly ?? t.payMaxHourly!)}${t.payMaxHourly && t.payMinHourly ? ` - $${Math.round(t.payMaxHourly)}` : ""}/hr`;
  if (row.pay_min || row.pay_max) return row.pay_period === "hour" ? `$${row.pay_min ?? row.pay_max}/hr` : `$${Math.round((row.pay_min ?? row.pay_max!) / 1000)}k${row.pay_max && row.pay_min ? ` - $${Math.round(row.pay_max / 1000)}k` : ""}`;
  return null;
};
