# Rails

STEM jobs (software, data, cloud, IT, cyber, product, electrical/mechanical/civil/chemical engineering, biotech, science, math/stats) plus nursing and allied health; nothing else ever reaches a feed (tags.field = "other" is filtered out). Nationwide first and international as data allows, for students and early-career-to-senior engineers. Jobright-class product (matched jobs with explained fit scores, tailored resumes, autofill, Autopilot with a human Submit, tracker, Coach), first users are NOVA / Mason students; nothing in the product assumes a region ("near me" comes from the user's own profile). Mockups: claude.ai/artifact/HhFu37rm9qU3itRdaRvfuC (17 screens).
Read PLAN.md at the start of every session and work the next unchecked item only.

## Stack
- Next.js 15 (App Router, src/), TypeScript, Tailwind
- Supabase: auth, Postgres + RLS, pgvector, storage (resume PDFs)
- Pricing and gating: PRICING.md is the source of truth; limits live in src/lib/billing/plans.ts. Free = 3 AI credits refilling every 72h, Autopilot preview-only. Pro $25/mo ($15 student) · Semester Pass $79 ($49 student, 4 months). Feed, scores, autofill, tracker are never gated. One hard paywall modal per session, always show the refill time.
- LLM: cheap model for parsing/field mapping, strong model only for resume tailoring
- Chrome extension: WXT + TypeScript, in /extension (Phase 3)
- Email inbound: Resend/Postmark inbound alias for outcome tracking (Gmail OAuth is a post-launch item — Google restricted-scope review takes 4–8 weeks)

## Non-negotiables
- Every tailored resume line traces to the canonical profile or to a skill the user typed in themselves ("add a skill you actually have"). Show the source; don't lecture the user about it.
- Human clicks Submit, always. Code never submits. Autopilot prepares; the user approves and clicks.
- EEO/demographic answers stay client-side (extension storage). Never stored server-side.
- No placement fees charged to candidates, ever.
- Telemetry on every extension fill: {domain, ats, selector, field, success} — from user one.

## Conventions
- Server actions over API routes unless an external caller needs it.
- Zod schemas in src/lib/schemas — the canonical profile schema is the source of truth.
- Every feature ships with a test. `npm test` must pass before a PLAN.md item is checked.
- Commit per PLAN.md item, message = the item text.

## Job data sources (tech-only; no LinkedIn/Indeed scraping)
- Greenhouse: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
- Lever: https://api.lever.co/v0/postings/{slug}?mode=json
- Ashby: https://api.ashbyhq.com/posting-api/job-board/{slug}
- SmartRecruiters: https://api.smartrecruiters.com/v1/companies/{slug}/postings
- Workday (undocumented, poll politely): https://{tenant}.wd{n}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
- USAJobs API (Pathways IT internships)
- Seed list: SimplifyJobs/Summer2027-Internships + vanshb03/New-Grad-2027 READMEs -> company, ATS, slug; plus hand-added DC list
- Fallback for week 1 only: an Apify ATS aggregator actor
- Off-board paste: user pastes any posting URL

## Product rules from the mockups
- Score colors: green >= 85, amber 70-84, red < 70. Every meter shows its number.
- Geo-gate CA and NY at signup (job-listing-service laws). Show "not yet available" copy.
- EEO answers never leave the extension. Career center dashboard is aggregate + flagged students only.
- Git commits end with:
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012FdxyrqoApT2sW1icRnvXe
