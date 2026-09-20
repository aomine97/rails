# Rails pricing pipeline

The customer: a student who is anxious, short on time, comparing themselves to classmates, and burned by tools that took money and gave nothing back. They want interviews, not features. They pay when (1) they have already seen the result, (2) losing it would hurt, and (3) the price feels like less than the anxiety.

Every gate below sits AFTER the value is visible and BEFORE it can be used. Nothing that brings people in (feed, scores, autofill, tracker) is ever gated.

## Ladder

| | Free | Pro $25/mo · $15 student | Semester Pass $79 · $49 student (4 mo) | Career Center (campus) |
|---|---|---|---|---|
| Job feed + fit scores + reasons | unlimited | unlimited | unlimited | unlimited |
| Autofill (extension) | unlimited | unlimited | unlimited | unlimited |
| Tracker + email alias | yes | yes | yes | yes + counselor view |
| Resume score | 1 full score, then re-score locked | unlimited | unlimited | unlimited |
| AI credits (tailor / cover letter / mock interview set) | **3, refill every 3 days** | unlimited | unlimited | unlimited |
| Autopilot | preview only: see what it would prepare | 10 apps / night | 20 apps / night | 20 / night |
| Coach | 3 messages / day | unlimited | unlimited | unlimited |
| Referral contacts | 1 reveal / day | unlimited | unlimited | unlimited |
| New-job alerts | daily digest | instant | instant | instant |
| "Got hired" pause | | | holds price + pauses | |
| Interview-rate report | | | | per program |

Anchor: $39.99 struck through next to $25. Student price needs a verified .edu (or a campus code from a Career Center). No weekly plan. 7-day refund.

## Credits: the habit loop

- Free users get 3 AI credits. 1 credit = one tailored resume, one cover letter, or one mock-interview question set.
- Credits refill to 3 every 72 hours from first use ("Refills Thursday 9:40 AM"). Unused credits do not stack. The refill time is shown everywhere a credit is spent.
- Why 3 days, not daily: a return date 2-3 days out is a reason to come back; daily refills get taken for granted and never feel scarce.
- Momentum meter on the home screen: "12 applications this week" with a bar to the next milestone. Progress people can see is progress they protect.

## The six upgrade moments (in priority order)

1. **Tailored resume, locked at download.** User spends a credit, sees the full diff and "Fit 71 → 86". They are out of credits for the next one, or want the PDF now. Modal: "Your tailored resume is ready. Fit 71 → 86. Unlock it now with Pro, or it refills in 2d 4h." Buttons: Start Pro (student $15) / Wait for refill. This is the single highest-intent moment: the result already exists, waiting feels like losing it.
2. **Autopilot preview.** Every night Autopilot runs for free users too, but the queue shows as locked cards: "Autopilot prepared 7 applications overnight (Capital One 91%, Booz Allen 88%...). Approve them with Pro." They see the work done and can't submit. Loss aversion, daily.
3. **Fit gap on job detail.** Any job under 85: "Tailoring would take this to ~88. Use 1 credit." Turns browsing into spending credits, which leads to moment 1.
4. **Momentum banner.** After the 5th application in a week: "Students who tailored every application: 17.8% interview rate. Without: 6.1%." (Real numbers from campus data once we have them; until then, hide this banner. Never fake it.)
5. **First reply in the tracker.** The moment an interview or OA lands: "Interview at Booz Allen. Prep with Coach: 3 mock questions from their posting." Pro gate on the 4th question.
6. **Founding price.** Real deadline, not a resetting timer: "$15 student price locked for everyone who joins before <date>." Raised to full price on that date, publicly.

Rules: at most one hard modal per session. Everything else is an inline banner with a dismiss. Every gate shows the refill time. The feed and autofill never show a paywall.

## Semester Pass psychology

Students think in semesters, not months. "One payment, whole recruiting season, and if you get hired in week 3 it cost you nothing more" removes the monthly cancel decision entirely. Push Semester Pass as the default on the pricing page for students (the middle card, highlighted); Pro monthly is the fallback for people who won't commit.

## Career Center

The campus pays, every student gets Pro, credits never run out on that campus. First three campuses free for a semester in exchange for the interview-rate case study. Counselors get the dashboard (screen 17). The student never sees a paywall, so adoption is the only metric.

## What this means for the code

- `plans.ts` holds the limits above as constants; every gated feature calls `can(user, "tailor")` which checks plan then credits.
- `credits` table: balance, refill_at. Refill is lazy (computed on read), no cron.
- Paywall components: one `<UpgradeModal reason="tailor_locked" />` with copy per reason, one `<UpgradeBanner />`.
- Stripe products: pro_monthly, pro_monthly_student, semester, semester_student. Student price requires `profiles.edu_verified`.
- Autopilot runs for free users too (preview). Cost is bounded by the 10/night cap and the nightly LLM budget.
