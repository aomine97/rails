# Rail — working codename (rename anytime)

Jobright for all careers. Horizontal engine, launched to NOVA students across all majors.
Read PLAN.md at the start of every session and work the next unchecked item only.

## Stack
- Next.js 15 (App Router, src/), TypeScript, Tailwind
- Supabase: auth, Postgres + RLS, pgvector, storage (resume PDFs)
- Stripe: free tier with daily limits, Pro $14.99/mo or $39/quarter
- LLM: cheap model for parsing/field mapping, strong model only for resume tailoring
- Chrome extension: WXT + TypeScript, in /extension (Phase 3)
- Email inbound: Resend/Postmark inbound alias for outcome tracking (Gmail OAuth is a post-launch item — Google restricted-scope review takes 4–8 weeks)

## Non-negotiables
- No-fabrication rule: every line of a tailored resume must trace to a span in the canonical profile or it is rejected.
- Human-confirm before any application submits. No autonomous submission in v1.
- EEO/demographic answers stay client-side (extension storage). Never stored server-side.
- No placement fees charged to candidates, ever.
- Telemetry on every extension fill: {domain, ats, selector, field, success} — from user one.

## Conventions
- Server actions over API routes unless an external caller needs it.
- Zod schemas in src/lib/schemas — the canonical profile schema is the source of truth.
- Every feature ships with a test. `npm test` must pass before a PLAN.md item is checked.
- Commit per PLAN.md item, message = the item text.

## Job data sources (legal, no scraping in v1)
- Greenhouse: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
- Lever: https://api.lever.co/v0/postings/{slug}?mode=json
- Ashby: https://api.ashbyhq.com/posting-api/job-board/{slug}
- One paid aggregator for non-tech coverage (Adzuna / Jooble / TheirStack) — key in .env
