-- AI cost controls (2026-09-23).
-- 1. Title triage: a cheap pass that decides whether a job is STEM/nursing before the full tagger reads it.
alter table public.jobs
  add column if not exists triage text check (triage in ('yes', 'no')),
  add column if not exists triaged_at timestamptz;
create index if not exists jobs_untriaged on public.jobs (first_seen_at desc)
  where tagged_at is null and triaged_at is null and closed_at is null;

-- 2. Every model call is metered, so spend is a query, not a guess, and the tagger can stop at a daily budget.
create table if not exists public.ai_usage (
  id bigserial primary key,
  at timestamptz not null default now(),
  day date not null default (now() at time zone 'utc')::date,
  feature text not null,            -- tag | tag_batch | triage | tailor | letter | answers | parse
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  batch boolean not null default false,
  usd numeric(12, 6) not null default 0
);
create index if not exists ai_usage_day_feature on public.ai_usage (day, feature);
alter table public.ai_usage enable row level security;  -- no policies: service role only

-- Spend by day and feature: select * from public.ai_spend_daily limit 30;
create or replace view public.ai_spend_daily with (security_invoker = true) as
  select day, feature, count(*) as calls, sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens, round(sum(usd)::numeric, 4) as usd
  from public.ai_usage group by day, feature order by day desc, usd desc;
revoke all on public.ai_spend_daily from anon, authenticated;

-- 3. Batch every 6 hours instead of once a night: same half price, jobs land in the feed the same day.
select cron.unschedule('rails-tag-batch');
select cron.schedule('rails-tag-batch', '0 */6 * * *', $$select public.call_cron('/api/cron/tag-batch?max=2000')$$);
