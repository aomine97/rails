# PLAN — Rails, 4-week launch

## STATUS (update at the end of every session — this is the handoff for a new chat)
- Last session: 2026-09-19. Week 1 backend written and unit-tested (15 tests pass, tsc + eslint clean): schema, companies seed (690), ATS adapters (Greenhouse/Lever/Ashby/SmartRecruiters/Workday/USAJobs), poller/verifier/tagger cron routes, canonical profile schema, scoring engine, geo-gate, shell extension.
- Next item: Ilyas does the account steps below, then me: "Auth: email + Google" (Week 1) and the Feed UI.
- DONE 2026-09-20: Supabase project prwzndifucrwldykcqft created, keys in .env.local, migration 0001 applied, 689 companies seeded (507 with feed slugs). Repo pushed to github.com/aomine97/rails.
- Blocked on (Ilyas, ~20 min):
  1. Anthropic API key -> .env.local ANTHROPIC_API_KEY (tagger)
  2. Chrome dev account ($5) -> upload extension-shell zip (see extension-shell/README.md), visibility Unlisted
  3. Vercel: import aomine97/rails (Hobby), paste .env.local into Environment Variables, deploy. Vercel Hobby crons are daily-only, so hourly poll + 15-min tag run from .github/workflows/cron.yml: add repo secrets APP_URL and CRON_SECRET (Settings -> Secrets and variables -> Actions).
- Known gaps: `npx tsc` reports a LayoutProps error in src/app/layout.tsx (Next 16 typegen; goes away after `next build`/`next dev` once). Tagger prompt untested against the model. Workday detail fetch is ~0.5-1s per posting: poller should fetch details only for NEW postings (todo in ingest.ts). SmartRecruiters same.
- Decisions made: name Rails; tech-only (software, data, cloud, IT, cyber); pricing below; human clicks Submit always; career centers are the B2B channel; no LinkedIn/Indeed scraping; geo-gate CA and NY at signup.

## Pricing (final)
- Free: full feed with fit scores, unlimited autofill, tracker, 1 resume score, 3 tailors/day. No card.
- Pro: $25/mo. Students with a verified .edu: $15/mo ($10 off, every month while enrolled). Anchor shown as $39.99 struck through. 7-day money back.
- Semester Pass: $79 / students $49, one payment, 4 months.
- No weekly plan. Referral: friend's first month $5, referrer gets a month free after friend's 2nd payment. "Got hired" pause holds the price.
- Career Center: quote per campus, unlimited students, counselor dashboard. First semester free for the first 3 pilot campuses.
- Launch price countdown = a real date (launch + 14 days), not a resetting timer.

## The 17 screens (canvas order) -> which week builds them
1 Landing + pricing (W4) · 2 Onboarding (W1) · 3 Feed (W1) · 3b Job detail (W2) · 4 Tailor (W2) · 5 Resume score (W2) · 6 Cover letter (W2) · 7 Autopilot (W3) · 8 Coach (W3) · 9 Mock interview (W5+) · 10 Connections (W5+) · 11 Tracker (W2) · 12 Extension panel (W3) · 13 System map (doc only) · 14 Empty states (W1, W2) · 15 Autofill settings (W3) · 16 Career center dashboard (W4, read-only v1)

## Week 1 — jobs flowing + profile + feed
- [~] Push repo to GitHub (done). Supabase (done). Stripe (test) + Anthropic keys -> .env.local (pending)
- [~] Shell extension built in /extension-shell (zip + upload = Ilyas, needs the $5 dev account)
- [x] Schema v0 applied to Supabase 2026-09-20: supabase/migrations/0001_init.sql (RLS, signup trigger, user_funnel + campus_funnel views)
- [ ] Auth: email + Google, RLS on every table. Geo-gate CA/NY at signup (state field + IP check, show "not yet available") — src/lib/geo.ts + supabase clients written, no auth UI yet
- [x] companies seed: scripts/seed-companies.mjs -> data/companies.json (690 companies, 508 with resolvable slugs: 241 Workday, 116 Greenhouse, 86 Ashby, 21 SmartRecruiters, 18 Lever). scripts/seed-db.mjs loads it
- [x] Adapters written + unit-tested on documented shapes: src/lib/ats/*. Poller: src/app/api/cron/poll (Vercel cron hourly). LIVE-VERIFIED 2026-09-20 from Ilyas's Mac: Workday (RTX, Booz Allen, NVIDIA incl. detail pages), Greenhouse (SpaceX 2505, Schonfeld, NISC), Lever (Palantir 313, CesiumAstro, Immuta), Ashby (Notion 128, Northwood, Bedrock), SmartRecruiters (Pilot, Solidigm, WD incl. detail). No adapter yet for icims/workable/jobvite (0 jobs, expected)
- [x] Verifier: src/app/api/cron/verify (daily 03:30). Feed-sourced jobs also close when they vanish from the feed
- [x] Normalizer (src/lib/jobs/ingest.ts) + tagger (src/lib/jobs/tagger.ts, Haiku, Zod-validated JobTags, cron every 10 min). Untested against the real model until ANTHROPIC_API_KEY exists
- [x] USAJobs adapter (needs USAJOBS_API_KEY + USAJOBS_USER_AGENT)
- [ ] Resume upload (PDF/DOCX) -> text -> canonical profile (Zod schema in src/lib/schemas) -> Onboarding "confirm your facts" screen (screen 2)
- [ ] Feed (screen 3): hard filters + scoring — scoring engine done and tested (src/lib/match/score.ts), no UI yet. Fit = weighted sub-scores (Experience / Skills / Field), color bands green >=85 / amber 70-84 / red <70. "N new since yesterday". Empty and loading states (screen 14)
- [ ] Off-board paste: paste any posting URL -> fetch, tag, score, add to feed as External

## Week 2 — apply: detail, tailor, score, letter, tracker, paywall
- [ ] Job detail (3b): qualifications checked line by line with the resume span that earned each ✓ / ! / ✗; autofill readiness; referral contacts placeholder
- [ ] Tailor (4): diff view, gap plan, "add a skill you actually have" (user-supplied only), before/after fit meter. Every added line traces to profile or a user-typed source
- [ ] Resume score (5): 0-100, 6 sub-bars, ranked fixes with point values, versions
- [ ] Cover letter (6): per-job, sources listed, plain tone
- [ ] Resume PDF export (one ATS-clean template)
- [ ] Tracker (11): pipeline funnel, table (via / age / stage / next), manual add, follow-up reminders. Email nudges via Resend
- [ ] Inbound email alias per user (Cloudflare Email Routing -> worker -> classify reply -> update stage)
- [ ] Stripe: Free limits (3 tailors/day), Pro checkout $25, .edu verification -> $15 price, Semester Pass one-time, customer portal, 7-day refund button
- [ ] Interview-rate metric: applications -> interviews per user and per campus, computed nightly. This is the number that goes on the landing page later

## Week 3 — extension + Autopilot + Coach
- [ ] WXT extension: auth handoff from web app, side panel (screen 12)
- [ ] Adapter: Workday (shadow DOM walker, multi-step, custom comboboxes) — first because DC contractors and banks are on it
- [ ] Adapter: Greenhouse
- [ ] Adapter: Lever
- [ ] Universal fallback: autocomplete -> name/data-automation-id -> label -> placeholder -> LLM field mapper
- [ ] Autofill settings (15): standard answers, EEO stays client-side, per-site overrides
- [ ] Human-confirm overlay; Submit is never clicked by code
- [ ] Fill telemetry -> fill_events; learned selector map per domain
- [ ] Autopilot (7): nightly job picks above the user's fit floor, tailors + letter + prefill, queue UI, "Approve N -> board" opens tabs one at a time
- [ ] Coach (8): chat with tracker context; canned pattern insights (0 interviews after 20 apps -> resume score check, only 200+ applicant roles -> mix in fewer-applicant roles)
- [ ] Replace shell extension listing with the real build (review already running)

## Week 4 — launch
- [ ] Landing page (1) from the mockup, pricing section with .edu toggle, real countdown date
- [ ] Career center dashboard (16), read-only v1: campus stats, flagged students, interview rate by program, funnel. Invite-only
- [ ] Terms, privacy, refund policy. CA/NY gate copy
- [ ] Onboarding: upload -> matches in under 60 seconds, timed
- [ ] Email NOVA Annandale career services with the dashboard screenshot + free pilot semester. Same email to Mason and 2 NOVA CS clubs
- [ ] Founder-face TikTok/Reels: 3 clips a week, "applied to 10 DC internships in 20 minutes" format
- [ ] r/nova, NOVA and Mason Discords, one post each, not spam
- [ ] Launch to first 50 users. Watch interview rate, fill success rate, Workday breakage

## Week 5+ (post-launch)
- [ ] Mock interview (9) voice, OA drills (HackerRank/CodeSignal style) — the funnel drop is OA -> interview
- [ ] Connections / referral finder (10)
- [ ] iCIMS, Taleo, SmartRecruiters fill adapters
- [ ] Mobile layouts for feed, tracker, Coach (390 wide)
- [ ] Salary negotiation module in Coach
- [ ] Callback-probability model once >= 2,000 labeled applications
- [ ] Product Hunt
- [ ] Widen by school (VT, JMU, VCU), not by degree

## Weekly founder work (Ilyas, non-negotiable)
- 5 customer conversations (NOVA/Mason CS + IT students)
- 1 career-services / club contact
- Review fill telemetry, Workday breakage, interview-rate number
