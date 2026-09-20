# PLAN — Rails, 4-week launch

## STATUS (update at the end of every session — this is the handoff for a new chat)
- Last session: 2026-09-19. Week 1 backend written and unit-tested (15 tests pass, tsc + eslint clean): schema, companies seed (690), ATS adapters (Greenhouse/Lever/Ashby/SmartRecruiters/Workday/USAJobs), poller/verifier/tagger cron routes, canonical profile schema, scoring engine, geo-gate, shell extension.
- Next item: Phase 1, Tailor (4).
- Feed feedback round 1 (2026-09-20) applied: levels now include mid/senior (defaults from years of experience), scores recalibrated (relevant jobs 65-90 instead of 40-60), location defaults to US + remote with DC/MD/VA chip, same-title-many-cities grouped into one card, summary + 2 requirement lines per card, gap skills are "+ add" buttons (source:user), Apply asks "Did you apply?" and fills the Applied tab, Hidden tab with Unhide, Newest sort, match panel widened to 300px. Tagger now emits summary/relocation/country for new jobs (older rows fall back to a description snippet and the location heuristic).
- DONE 2026-09-20: Supabase project prwzndifucrwldykcqft created, keys in .env.local, migration 0001 applied, 689 companies seeded (507 with feed slugs). Repo pushed to github.com/aomine97/rails. Vercel deployed: https://rails-psi.vercel.app (Hobby). Anthropic key + CRON_SECRET set in .env.local and Vercel. GitHub Actions cron secrets set. Chrome Web Store shell submitted. PIPELINE VERIFIED LIVE 2026-09-20: 1,871 jobs from 14 companies after the first polls, tagger returns level/field/skills/requirements (11 of 12 in the first tagged batch).
- Blocked on: nothing. Ilyas onboarded 2026-09-20 (36 skills, 3 roles parsed). Push and look at /app: first real feed. Report scores that look wrong; that tunes score.ts weights. For Google sign-in: create an OAuth client in Google Cloud (Web application, redirect URI https://prwzndifucrwldykcqft.supabase.co/auth/v1/callback), paste client ID + secret into Supabase -> Authentication -> Providers -> Google. Also: Supabase -> Authentication -> URL Configuration -> Site URL = https://rails-psi.vercel.app, add https://rails-psi.vercel.app/auth/callback to Redirect URLs (otherwise email confirmation links go to localhost).
- Known gaps (feed): 10k+ jobs but only the tagged ones show (tagger does ~2,300/day; raise tag batch when the Anthropic bill allows). No company logos/size. No mobile layout. No alerts. Old rows lack summary until re-tagged. Some Workday sites returned exactly 40 postings on the first poll (NXP, Visa, GM, First National); check whether page 3 of the cxs list endpoint fails for those tenants. Tagger puts most skills under preferredSkills when postings say "familiarity with"; scoring already weights preferred at 0.5 so it's fine for now. `npx tsc` reports a LayoutProps error in src/app/layout.tsx (Next 16 typegen; goes away after `next build`/`next dev` once). Tagger prompt untested against the model. Poller is list-only + details for up to 40 new postings per company per run; tag cron backfills the rest (done 2026-09-20).
- Decisions made: name Rails; tech-only (software, data, cloud, IT, cyber); pricing below; human clicks Submit always; career centers are the B2B channel; no LinkedIn/Indeed scraping; geo-gate CA and NY at signup.

## Pricing (final; full pipeline in PRICING.md)
- Free: full feed with fit scores, unlimited autofill, tracker, 1 resume score, 3 tailors/day. No card.
- Pro: $25/mo. Students with a verified .edu: $15/mo ($10 off, every month while enrolled). Anchor shown as $39.99 struck through. 7-day money back.
- Semester Pass: $79 / students $49, one payment, 4 months.
- No weekly plan. Referral: friend's first month $5, referrer gets a month free after friend's 2nd payment. "Got hired" pause holds the price.
- Career Center: quote per campus, unlimited students, counselor dashboard. First semester free for the first 3 pilot campuses.
- Launch price countdown = a real date (launch + 14 days), not a resetting timer.

## The 17 screens (canvas order) -> which phase builds them
1 Landing + pricing (W4) · 2 Onboarding (W1) · 3 Feed (W1) · 3b Job detail (W2) · 4 Tailor (W2) · 5 Resume score (W2) · 6 Cover letter (W2) · 7 Autopilot (W3) · 8 Coach (W3) · 9 Mock interview (W5+) · 10 Connections (W5+) · 11 Tracker (W2) · 12 Extension panel (W3) · 13 System map (doc only) · 14 Empty states (W1, W2) · 15 Autofill settings (W3) · 16 Career center dashboard (W4, read-only v1)

## Week 1 — jobs flowing + profile + feed
- [x] Push repo to GitHub, Supabase, Anthropic key, Vercel deploy (done). Stripe test keys still pending (Week 2)
- [x] Shell extension submitted to the Chrome Web Store 2026-09-20 (Unlisted). Review clock running
- [x] Schema v0 applied to Supabase 2026-09-20: supabase/migrations/0001_init.sql (RLS, signup trigger, user_funnel + campus_funnel views)
- [x] Auth: email + password (signup/login/callback/signout), Google button wired (needs the Google OAuth client set up in Supabase -> Authentication -> Providers -> Google; until then the button shows "not configured"). Geo-gate: proxy.ts redirects CA/NY by Vercel region header, signup form checks the chosen state, /not-yet has a waitlist. Migrations 0002 (credits) + 0003 (waitlist, state on profile) applied 2026-09-20. Design tokens in globals.css, Inter Tight + Geist fonts, /app placeholder shell, interim landing
- [x] companies seed: scripts/seed-companies.mjs -> data/companies.json (690 companies, 508 with resolvable slugs: 241 Workday, 116 Greenhouse, 86 Ashby, 21 SmartRecruiters, 18 Lever). scripts/seed-db.mjs loads it
- [x] Adapters written + unit-tested on documented shapes: src/lib/ats/*. Poller: src/app/api/cron/poll (Vercel cron hourly). LIVE-VERIFIED 2026-09-20 from Ilyas's Mac: Workday (RTX, Booz Allen, NVIDIA incl. detail pages), Greenhouse (SpaceX 2505, Schonfeld, NISC), Lever (Palantir 313, CesiumAstro, Immuta), Ashby (Notion 128, Northwood, Bedrock), SmartRecruiters (Pilot, Solidigm, WD incl. detail). No adapter yet for icims/workable/jobvite (0 jobs, expected)
- [x] Verifier: src/app/api/cron/verify (daily 03:30). Feed-sourced jobs also close when they vanish from the feed
- [x] Normalizer (src/lib/jobs/ingest.ts) + tagger (src/lib/jobs/tagger.ts, Haiku, Zod-validated JobTags, cron every 15 min via GitHub Actions). Verified against the real model 2026-09-20
- [x] USAJobs adapter (needs USAJOBS_API_KEY + USAJOBS_USER_AGENT)
- [x] Resume upload (PDF/DOCX via unpdf + mammoth) -> private `resumes` bucket -> Sonnet parse (src/lib/profile/parse.ts, Zod-tolerant) -> normalizeParsed -> profiles.canonical -> /onboarding/confirm (screen 2: edit everything, add skills marked source:user, work auth / clearance / locations / employment types, attest checkbox) -> onboarding_done -> /app. Migration 0004 (bucket) applied. UNTESTED END-TO-END with a real resume; Ilyas runs it first
- [x] Feed (screen 3): /app = app shell (icon rail, tabs Recommended/Liked/Applied/External, level/field/remote chips, search), buildFeed() (src/lib/match/feed.ts, tested) scores every tagged open job against profiles.canonical on request, drops mid/senior and levels the user is not looking for, sorts by fit. Cards: badges, matched/missing skill chips, hard-block reasons, Apply now (external), Like/Hide (matches table), MatchPanel ring + 3 meters with numbers. "N new since yesterday". Empty + loading states. Scoring is per-request (fine to ~5k jobs); move to a nightly scorer when it gets slow
- [ ] Off-board paste: paste any posting URL -> fetch, tag, score, add to feed as External

## Scope (decided 2026-09-20)
Tech jobs, nationwide first, international as data allows. Students AND experienced engineers (levels internship -> senior). "Near me" comes from each user's own profile, never a fixed region. Nothing in the product assumes NOVA or DC; that is only where the first users are.

## Phase 1 — the loop a single user can live in (this week)
Goal: one person can find, understand, tailor for, and track a job without leaving Rails.
- [x] Job detail (3b): /app/jobs/[id]. Full description, every requirement line checked ✓/!/✗ with the profile line that earned it, "why this score" sentences (src/lib/match/explain.ts), "+ I have X, add it" on missing lines, similar jobs ranked for you, Apply + did-you-apply, Like/Hide, Tailor button (disabled until Tailor ships). Feed titles now open the detail page; "Original posting ↗" opens the ATS
- [ ] Split view on Apply: the detail page stays open next to the ATS tab with the requirement checklist and the tailored resume ready to copy
- [ ] Tailor (4): diff view, gap plan, before/after fit, only profile facts + user-added skills, PDF export, 1 credit
- [ ] Resume score (5): 0-100, 6 sub-bars, ranked fixes, versions
- [ ] Cover letter (6): per-job, plain, 1 credit
- [ ] Off-board paste: any posting URL -> fetch, tag, score, External tab
- [ ] Tracker (11) v1: stages, manual add, notes, follow-up reminders (no email yet)
- [ ] Billing per PRICING.md: credits live (spend_credit), UpgradeModal/Banner with the six moments, Stripe (Pro / Pro student / Semester / Semester student), .edu verification, customer portal, 7-day refund

## Phase 2 — data that deserves a nationwide product (next 2 weeks, runs alongside Phase 1)
Goal: every relevant tech posting in the US, tagged within the hour; the international ones that make sense.
- [ ] Tagger throughput: pre-tag (done), batch 48 / 10 min (done), then a nightly bulk run. Target: every new posting tagged within 60 min
- [ ] Adapters: iCIMS, Workable, Jobvite, Oracle Recruiting Cloud, Taleo (the "0 jobs" rows). ~130 more companies from the seed alone
- [ ] Company discovery: crawl careers pages of the Fortune 1000 + YC + Inc 5000 tech list for ATS slugs; Greenhouse/Lever/Ashby board-token discovery; user-pasted URLs auto-add the company
- [ ] Workday page-3 bug (some tenants stop at 40)
- [ ] Company table: logo (favicon fallback), size, industry, HQ, "sponsors clearance", "hires from <school>" from user-reported outcomes
- [ ] International: country on every job (tagger does it now), currency-aware pay, country chips (CA, UK, IN, DE first), work-auth aware scoring per country
- [ ] Alerts: instant for Pro, daily digest for Free (needs Resend + a domain)

## Phase 3 — the machine (weeks 3-4)
- [ ] Extension real build (WXT): Workday, Greenhouse, Lever, iCIMS adapters, universal fallback, human-confirm overlay, telemetry, learned selectors. Replaces the shell listing
- [ ] Autopilot (7): nightly prep above the fit floor, queue UI, approve -> board. Preview for Free
- [ ] Coach (8) with tracker context; interview-rate metric nightly; momentum banner once real
- [ ] Inbound email alias -> stage updates; follow-up nudges
- [ ] Landing page (1) from the mockup + real pricing page + legal + CA/NY gate copy

## Phase 4 — everyone else (weeks 5-8)
- [ ] Mobile layouts for feed, detail, tracker, Coach
- [ ] Mock interview (9) + OA drills; Referrals (10); Autofill settings (15)
- [ ] Career center dashboard (16) + campus plan; first 3 pilot campuses
- [ ] Callback-probability model once >= 2,000 labeled applications
- [ ] Product Hunt; widen by school and by country

## Weekly founder work (Ilyas, non-negotiable)
- 5 customer conversations (NOVA/Mason CS + IT students)
- 1 career-services / club contact
- Review fill telemetry, Workday breakage, interview-rate number
