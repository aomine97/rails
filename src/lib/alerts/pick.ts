import type { CanonicalProfile } from "../schemas/profile";
import { buildFeed, type FeedItem, type FeedJobRow } from "../match/feed";

/** Pure: which jobs deserve an email? New since `since`, in the user's area, at or above their fit floor, best first, capped. */
export function pickAlertJobs(profile: CanonicalProfile, rows: FeedJobRow[], opts: { since: string; minFit: number; where: string; hidden?: Set<string>; max?: number }, now = new Date()): FeedItem[] {
  const sinceMs = Date.parse(opts.since);
  const fresh = rows.filter((r) => Date.parse(r.first_seen_at) > sinceMs && !(opts.hidden?.has(r.id)));
  const feed = buildFeed(profile, fresh, { where: opts.where, sort: "fit" }, now);
  return feed.items.filter((i) => i.score.fit >= opts.minFit && i.score.hardBlocks.length === 0).slice(0, opts.max ?? 12);
}
