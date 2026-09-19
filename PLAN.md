# PLAN — 4-week launch

## STATUS (update at the end of every session — this is the handoff for a new chat)
- Last session: 2026-09-18. Scaffolded Next.js app, installed supabase/zod/stripe, wrote CLAUDE.md + PLAN.md, 2 commits.
- Next item: Week 1 -> "Supabase project, schema v0".
- Blocked on: Ilyas creating Supabase project, Stripe test account, Anthropic key, Adzuna key -> .env.local. GitHub repo not yet pushed (no gh on device).
- Decisions made: codename Rail; wedge = NOVA all majors; Pro $14.99/mo or $39/quarter; Gmail OAuth deferred (use inbound email alias); 3 ATS adapters in month one (Greenhouse, Lever, Workday).

Target: public launch to NOVA in 4 weeks. 500 signups, 50 paid, 2,000 tracked applications by day 45.
Cut from month one: referral finder, iCIMS/Taleo adapters, autonomous agent, employer dashboard, mobile, Gmail OAuth.

## Week 1 — foundation + profile + jobs
- [x] Scaffold Next.js app
- [ ] Supabase project, schema v0: users, profiles, resumes, jobs, applications, fill_events
- [ ] Auth (email + Google) with RLS
- [ ] Resume upload (PDF/DOCX) -> text extraction
- [ ] Canonical profile: Zod schema + LLM parse -> profiles table
- [ ] Profile review/edit UI (user confirms parsed data)
- [ ] Job ingest cron: Greenhouse/Lever/Ashby feeds from a seed list of ~300 companies
- [ ] Aggregator ingest for non-tech roles (pick one, wire it)
- [ ] Job normalization + embedding (pgvector)

## Week 2 — match + tailoring + paywall
- [ ] Match feed: vector similarity + hard filters (location, authorization, schedule, credential)
- [ ] Fit breakdown per job (which requirements hit / missed)
- [ ] Tailored resume generation with span-tracing no-fabrication check
- [ ] Resume PDF export (one clean ATS template)
- [ ] Stripe: free tier limits (3 tailors/day) + Pro checkout + customer portal
- [ ] Manual application tracker (status: applied / screen / interview / offer / rejected)

## Week 3 — extension + outcome loop
- [ ] WXT extension scaffold, auth handoff from web app
- [ ] Adapter: Greenhouse
- [ ] Adapter: Lever
- [ ] Adapter: Workday (shadow DOM walker, multi-step, custom comboboxes)
- [ ] Universal fallback: label/placeholder cascade + LLM field mapper
- [ ] Human-confirm overlay before submit
- [ ] Fill telemetry -> fill_events
- [ ] Inbound email alias per user for recruiter replies -> auto-status classification

## Week 4 — launch
- [ ] Landing page + transparent pricing page
- [ ] Terms, privacy policy, refund policy
- [ ] Onboarding: upload -> matches in under 60 seconds
- [ ] Chrome Web Store submission (submit by day 22 — review takes days)
- [ ] NOVA outreach: career services email, 3 club Discords, r/nova, TikTok demo clips
- [ ] Launch

## Week 5+ (post-launch)
- [ ] Referral finder
- [ ] iCIMS, Taleo, SmartRecruiters adapters
- [ ] Gmail OAuth (start Google verification the day of launch)
- [ ] Callback-probability model once >= 2,000 labeled applications
- [ ] Product Hunt

## Weekly founder work (Ilyas, non-negotiable)
- 5 customer conversations
- 1 career-services / club contact
- Review fill telemetry and outcome data
