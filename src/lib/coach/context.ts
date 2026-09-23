/** Coach context: everything Coach knows, computed from the user's own data. Pure, no I/O, tested.
 *  Coach answers from these facts, never from generic advice, and names the rows it used. */
import { daysSince, funnel, followUpFor, STAGE_LABEL, type Funnel, type TrackedApp } from "../tracker/stages";
import type { CanonicalProfile } from "../schemas/profile";

export type CoachApp = TrackedApp & { tailored: boolean };

export type Momentum = { applied7: number; withRate: number; withoutRate: number; withN: number; withoutN: number };

export type CoachFacts = {
  funnel: Funnel;
  applied7: number;
  quiet: { company: string; title: string; days: number }[];
  dueFollowUps: number;
  momentum: Momentum | null;
  resumeScore: number | null;
  targets: string[];
  topSkills: string[];
  clearance: string;
  workAuth: string;
  school: string | null;
};

const APPLIED = (a: TrackedApp) => a.stage !== "saved" && a.stage !== "prepared";
const GOT_INTERVIEW = (a: TrackedApp) => a.stage === "interview" || a.stage === "offer";

/** Tailored vs untailored interview rates. Only "real" once each side has at least 3 applications; before that it would be noise. */
export function momentum(apps: CoachApp[], now: number): Momentum | null {
  const applied = apps.filter(APPLIED);
  const withT = applied.filter((a) => a.tailored), without = applied.filter((a) => !a.tailored);
  if (withT.length < 3 || without.length < 3) return null;
  const rate = (xs: CoachApp[]) => Math.round((100 * xs.filter(GOT_INTERVIEW).length) / xs.length);
  const applied7 = applied.filter((a) => (daysSince(a.applied_at ?? a.created_at, now) ?? 99) < 7).length;
  return { applied7, withRate: rate(withT), withoutRate: rate(without), withN: withT.length, withoutN: without.length };
}

export function coachFacts(profile: CanonicalProfile | null, apps: CoachApp[], now: number, resumeScore: number | null): CoachFacts {
  const quiet = apps
    .filter((a) => a.stage === "applied" || a.stage === "viewed")
    .map((a) => ({ company: a.company_name, title: a.title, days: daysSince(a.last_activity_at, now) ?? 0 }))
    .filter((q) => q.days >= 7)
    .sort((a, b) => b.days - a.days);
  const due = apps.map((a) => followUpFor(a, now)).filter((f) => f && f.kind !== "suggested").length;
  const edu = profile?.education?.[0];
  return {
    funnel: funnel(apps),
    applied7: apps.filter(APPLIED).filter((a) => (daysSince(a.applied_at ?? a.created_at, now) ?? 99) < 7).length,
    quiet,
    dueFollowUps: due,
    momentum: momentum(apps, now),
    resumeScore,
    targets: profile?.targetRoles ?? [],
    topSkills: (profile?.skills ?? []).filter((s) => s.level !== "familiar").slice(0, 15).map((s) => s.name),
    clearance: profile?.constraints?.clearance ?? "none",
    workAuth: profile?.constraints?.workAuthorization ?? "unknown",
    school: edu ? `${edu.school}${edu.degree ? `, ${edu.degree}` : ""}${edu.field ? ` ${edu.field}` : ""}${edu.gradYear ? ` (${edu.gradYear})` : ""}` : null,
  };
}

/** "Your line": the next five things, derived from state. Done ones stay visible so progress is visible. */
export type Step = { label: string; done: boolean; detail: string; href: string };
export function coachPlan(f: CoachFacts): Step[] {
  const tailoredApps = f.momentum ? f.momentum.withN : 0;
  return [
    { label: "Base resume to 70+", done: (f.resumeScore ?? 0) >= 70, detail: f.resumeScore == null ? "Not scored yet" : `Now ${f.resumeScore}`, href: "/app/resume" },
    { label: "10 applications out", done: f.funnel.applied >= 10, detail: `${f.funnel.applied} of 10`, href: "/app" },
    { label: "Tailor at least 5", done: tailoredApps >= 5, detail: f.momentum ? `${tailoredApps} tailored` : "Tailor from any job page", href: "/app" },
    { label: "Clear your follow-ups", done: f.dueFollowUps === 0 && f.quiet.length === 0, detail: f.dueFollowUps + f.quiet.length ? `${f.dueFollowUps + f.quiet.length} waiting` : "Nothing waiting", href: "/app/tracker" },
    { label: "One mock interview", done: false, detail: "Built from a posting you applied to", href: "/app/interview" },
  ];
}

/** The block the model reads. Numbered application rows so the answer can cite them. Capped so it stays cheap. */
export function coachContext(f: CoachFacts, apps: CoachApp[], now: number): string {
  const rows = apps.slice(0, 60).map((a, i) => {
    const d = daysSince(a.applied_at ?? a.created_at, now);
    const idle = daysSince(a.last_activity_at, now);
    return `${i + 1}. ${a.company_name} | ${a.title} | ${STAGE_LABEL[a.stage]} | applied ${d == null ? "?" : `${d}d ago`} | quiet ${idle ?? "?"}d | ${a.tailored ? "tailored" : "not tailored"}${a.notes ? ` | note: ${a.notes.slice(0, 120).replace(/\s+/g, " ")}` : ""}`;
  });
  const m = f.momentum;
  return [
    `PROFILE: targets ${f.targets.join(", ") || "not set"}; school ${f.school ?? "not set"}; clearance ${f.clearance}; work authorization ${f.workAuth}; skills ${f.topSkills.join(", ") || "none listed"}; resume score ${f.resumeScore ?? "not scored"}/100.`,
    `NUMBERS: ${f.funnel.applied} applied, ${f.applied7} in the last 7 days, ${f.funnel.oa} reached OA or further, ${f.funnel.interviews} interviews, ${f.funnel.offers} offers; interview rate ${f.funnel.interviewRate ?? "n/a"}%; response rate ${f.funnel.responseRate ?? "n/a"}%.`,
    m ? `TAILORED VS NOT: tailored ${m.withRate}% interview rate over ${m.withN}; not tailored ${m.withoutRate}% over ${m.withoutN}.` : "TAILORED VS NOT: not enough data yet (needs 3+ on each side).",
    `QUIET 7+ DAYS: ${f.quiet.map((q) => `${q.company} (${q.days}d)`).join(", ") || "none"}. Follow-ups due: ${f.dueFollowUps}.`,
    `APPLICATIONS (${apps.length}):`,
    ...(rows.length ? rows : ["none yet"]),
  ].join("\n");
}

export const COACH_SUGGESTIONS = [
  "What should I apply to this week?",
  "Why am I not getting callbacks?",
  "Which applications should I follow up on?",
  "How do I answer the salary question?",
];
