/** Tracker v1: stage ladder, grouping, and the follow-up rules. Pure, no I/O. */

export type Stage = "saved" | "prepared" | "applied" | "viewed" | "oa" | "interview" | "offer" | "rejected" | "withdrawn";

export const STAGES: Stage[] = ["saved", "prepared", "applied", "viewed", "oa", "interview", "offer", "rejected", "withdrawn"];

export const STAGE_LABEL: Record<Stage, string> = {
  saved: "Saved", prepared: "Prepared", applied: "Applied", viewed: "Viewed", oa: "Online assessment", interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn",
};

/** Board columns. Saved+Prepared share a column; rejected/withdrawn share "Closed". */
export const COLUMNS: { key: string; label: string; stages: Stage[] }[] = [
  { key: "saved", label: "Saved", stages: ["saved", "prepared"] },
  { key: "applied", label: "Applied", stages: ["applied", "viewed"] },
  { key: "oa", label: "OA", stages: ["oa"] },
  { key: "interview", label: "Interview", stages: ["interview"] },
  { key: "offer", label: "Offer", stages: ["offer"] },
  { key: "closed", label: "Closed", stages: ["rejected", "withdrawn"] },
];

export type TrackedApp = {
  id: string;
  title: string;
  company_name: string;
  url: string | null;
  stage: Stage;
  applied_at: string | null;
  last_activity_at: string;
  next_action: string | null;
  next_action_at: string | null;
  notes: string | null;
  job_id: string | null;
  created_at: string;
};

export const DAY = 86_400_000;

export function daysSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso); if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY);
}

export type FollowUp = { kind: "overdue" | "due" | "suggested"; text: string; days: number };

/**
 * What the user should do next for this application, if anything.
 * 1. An explicit reminder that is due today or past -> "due" / "overdue".
 * 2. Applied with no movement for 7+ days and no reminder set -> suggest a follow-up.
 * 3. Interview stage with no movement for 3+ days -> suggest a thank-you / status check.
 * 4. OA with no movement for 5+ days -> suggest checking the deadline.
 */
export function followUpFor(a: TrackedApp, now: number): FollowUp | null {
  if (a.next_action_at) {
    const d = daysSince(a.next_action_at, now) ?? 0;
    if (d > 0) return { kind: "overdue", text: a.next_action ?? "Follow up", days: d };
    if (d === 0) return { kind: "due", text: a.next_action ?? "Follow up", days: 0 };
    return null;
  }
  const idle = daysSince(a.last_activity_at, now) ?? 0;
  if ((a.stage === "applied" || a.stage === "viewed") && idle >= 7) return { kind: "suggested", text: `No reply in ${idle} days. Send a short follow-up.`, days: idle };
  if (a.stage === "interview" && idle >= 3) return { kind: "suggested", text: `${idle} days since your interview. Send a thank-you or ask for an update.`, days: idle };
  if (a.stage === "oa" && idle >= 5) return { kind: "suggested", text: `OA pending ${idle} days. Check the deadline.`, days: idle };
  return null;
}

export function groupByColumn(apps: TrackedApp[]): Record<string, TrackedApp[]> {
  const out: Record<string, TrackedApp[]> = {};
  for (const c of COLUMNS) out[c.key] = [];
  for (const a of apps) {
    const col = COLUMNS.find((c) => c.stages.includes(a.stage)) ?? COLUMNS[0];
    out[col.key].push(a);
  }
  for (const k of Object.keys(out)) out[k].sort((x, y) => Date.parse(y.last_activity_at) - Date.parse(x.last_activity_at));
  return out;
}

export type Funnel = { total: number; applied: number; oa: number; interviews: number; offers: number; interviewRate: number | null; responseRate: number | null };

/** The numbers on top of the tracker. Rates are percentages of applications that left "saved". */
export function funnel(apps: TrackedApp[]): Funnel {
  const applied = apps.filter((a) => a.stage !== "saved" && a.stage !== "prepared").length;
  const responded = apps.filter((a) => ["viewed", "oa", "interview", "offer", "rejected"].includes(a.stage)).length;
  const oa = apps.filter((a) => ["oa", "interview", "offer"].includes(a.stage)).length;
  const interviews = apps.filter((a) => ["interview", "offer"].includes(a.stage)).length;
  const offers = apps.filter((a) => a.stage === "offer").length;
  const pct = (n: number) => (applied ? Math.round((100 * n) / applied) : null);
  return { total: apps.length, applied, oa, interviews, offers, interviewRate: pct(interviews), responseRate: pct(responded) };
}

/** Sort the "Up next" list: overdue first (most days), then due today, then suggestions. */
export function upNext(apps: TrackedApp[], now: number): { app: TrackedApp; f: FollowUp }[] {
  const rank = { overdue: 0, due: 1, suggested: 2 };
  return apps
    .filter((a) => !["rejected", "withdrawn", "offer"].includes(a.stage))
    .map((app) => ({ app, f: followUpFor(app, now) }))
    .filter((x): x is { app: TrackedApp; f: FollowUp } => x.f !== null)
    .sort((a, b) => rank[a.f.kind] - rank[b.f.kind] || b.f.days - a.f.days);
}
