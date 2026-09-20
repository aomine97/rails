import type { CanonicalProfile } from "../schemas/profile";
import { buildFeed, type FeedItem, type FeedJobRow } from "../match/feed";
import { LIMITS, type Plan } from "../billing/plans";

/** How many Autopilot prepares per night for this plan. Free gets the preview count (10) but nothing is tailored. */
export function nightlyCap(plan: Plan): { count: number; prepare: boolean } {
  const n = LIMITS[plan].autopilotPerNight;
  return n > 0 ? { count: n, prepare: true } : { count: 10, prepare: false };
}

/**
 * Pure: tonight's picks. New in the last `hours`, in the user's area, fit >= floor, no hard blocks, not hidden/applied/already queued.
 * One per company so a night is not ten Capital One postings.
 */
export function pickAutopilot(profile: CanonicalProfile, rows: FeedJobRow[], opts: { minFit: number; where: string; exclude: Set<string>; max: number; sinceMs: number }, now = new Date()): FeedItem[] {
  const fresh = rows.filter((r) => Date.parse(r.first_seen_at) >= opts.sinceMs && !opts.exclude.has(r.id));
  const feed = buildFeed(profile, fresh, { where: opts.where, sort: "fit" }, now);
  const out: FeedItem[] = []; const companies = new Set<string>();
  for (const i of feed.items) {
    if (i.score.fit < opts.minFit || i.score.hardBlocks.length) continue;
    const co = (i.job.companies?.name ?? "").toLowerCase();
    if (co && companies.has(co)) continue;
    companies.add(co); out.push(i);
    if (out.length >= opts.max) break;
  }
  return out;
}
