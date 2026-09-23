-- Inbound email alias -> stage updates; follow-up nudges.
-- Only sender, subject and a short snippet are kept. The body is read once by /api/inbound/email and dropped.
create table if not exists public.inbound_emails (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_addr text not null default '',
  subject text not null default '',
  snippet text not null default '',
  kind text,                                   -- confirmation | rejection | oa | interview | offer | other
  application_id uuid references public.applications(id) on delete set null,
  moved_to app_stage,                          -- the stage this email moved the application to, if any
  status text not null default 'unmatched' check (status in ('moved', 'matched', 'unmatched', 'verification', 'ignored')),
  created_at timestamptz not null default now()
);
create index if not exists inbound_emails_user on public.inbound_emails (user_id, created_at desc);
alter table public.inbound_emails enable row level security;
create policy "inbound own read" on public.inbound_emails for select using (auth.uid() = user_id);
create policy "inbound own update" on public.inbound_emails for update using (auth.uid() = user_id);
create policy "inbound own delete" on public.inbound_emails for delete using (auth.uid() = user_id);

alter table public.profiles
  add column if not exists nudges_enabled boolean not null default true,
  add column if not exists nudges_last_sent_at timestamptz;

-- 08:00 ET: one email per user with the follow-ups that are due (skipped until Resend keys are set).
select cron.schedule('rails-nudges', '0 12 * * *', $$select public.call_cron('/api/cron/nudges')$$);
