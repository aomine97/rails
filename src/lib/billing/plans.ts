/** Single source of truth for what each plan can do. Mirrors PRICING.md. */
export type Plan = "free" | "pro" | "semester" | "campus";

export const PRICES = {
  anchorMonthly: 39.99,
  proMonthly: 25, proMonthlyStudent: 15,
  semester: 79, semesterStudent: 49, semesterMonths: 4,
} as const;

export const LIMITS: Record<Plan, {
  aiCredits: number | "unlimited";      // tailor / cover letter / mock set
  creditRefillHours: number;
  autopilotPerNight: number;            // 0 = preview only
  coachMessagesPerDay: number | "unlimited";
  referralRevealsPerDay: number | "unlimited";
  resumeScores: number | "unlimited";
  instantAlerts: boolean;
}> = {
  free:     { aiCredits: 3, creditRefillHours: 72, autopilotPerNight: 0,  coachMessagesPerDay: 3, referralRevealsPerDay: 1, resumeScores: 1, instantAlerts: false },
  pro:      { aiCredits: "unlimited", creditRefillHours: 0, autopilotPerNight: 10, coachMessagesPerDay: "unlimited", referralRevealsPerDay: "unlimited", resumeScores: "unlimited", instantAlerts: true },
  semester: { aiCredits: "unlimited", creditRefillHours: 0, autopilotPerNight: 20, coachMessagesPerDay: "unlimited", referralRevealsPerDay: "unlimited", resumeScores: "unlimited", instantAlerts: true },
  campus:   { aiCredits: "unlimited", creditRefillHours: 0, autopilotPerNight: 20, coachMessagesPerDay: "unlimited", referralRevealsPerDay: "unlimited", resumeScores: "unlimited", instantAlerts: true },
};

/** The six upgrade moments. Copy lives here so every surface says the same thing. */
export type PaywallReason = "tailor_locked" | "autopilot_preview" | "fit_gap" | "momentum" | "first_reply" | "founding_price";

export const PAYWALL_COPY: Record<PaywallReason, { title: (v: Record<string, string | number>) => string; body: (v: Record<string, string | number>) => string; cta: string; secondary: string | null; hard: boolean }> = {
  tailor_locked:     { title: (v) => `Your tailored resume is ready. Fit ${v.before} → ${v.after}.`, body: (v) => `Unlock it now with Pro, or your credits refill in ${v.refillIn}.`, cta: "Start Pro", secondary: "Wait for refill", hard: true },
  autopilot_preview: { title: (v) => `Autopilot prepared ${v.count} applications overnight.`, body: () => "Each one is tailored and pre-filled. Approve them with Pro and they open ready to submit.", cta: "Approve with Pro", secondary: "Not now", hard: false },
  fit_gap:           { title: (v) => `Tailoring would take this to about ${v.projected}.`, body: (v) => `Uses 1 credit. You have ${v.credits} left.`, cta: "Tailor for this job", secondary: null, hard: false },
  momentum:          { title: (v) => `${v.apps} applications this week.`, body: (v) => `Students who tailored every application: ${v.withRate}% interview rate. Without: ${v.withoutRate}%.`, cta: "Tailor every application", secondary: "Dismiss", hard: false },
  first_reply:       { title: (v) => `${v.company} wants to talk.`, body: () => "Prep with Coach: mock questions built from their posting and your resume.", cta: "Start prep", secondary: "Later", hard: false },
  founding_price:    { title: (v) => `Student price locked at $${PRICES.proMonthlyStudent}/mo until ${v.date}.`, body: () => "Everyone who joins before then keeps it. It goes to full price after.", cta: "Lock it in", secondary: "Dismiss", hard: false },
};

/** One hard modal per session; banners are free. */
export const PAYWALL_RULES = { maxHardPerSession: 1, neverGate: ["feed", "scores", "autofill", "tracker"] as const };
