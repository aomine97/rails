-- New-job alerts: daily digest for Free, hourly instant for paid. Sent through Resend (RESEND_API_KEY + ALERTS_FROM env).
alter table public.profiles
  add column if not exists alerts_enabled boolean not null default true,
  add column if not exists alerts_min_fit int not null default 80,
  add column if not exists alerts_where text not null default 'us',        -- near | us | remote | anywhere | ISO-2
  add column if not exists alerts_last_sent_at timestamptz,
  add column if not exists unsubscribe_token text unique default encode(gen_random_bytes(16), 'hex');

create table if not exists public.alert_sends (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,                       -- digest | instant
  job_ids uuid[] not null,
  provider_id text,
  sent_at timestamptz not null default now()
);
alter table public.alert_sends enable row level security;
create policy "own alert sends" on public.alert_sends for select using (auth.uid() = user_id);
create index if not exists alert_sends_user on public.alert_sends (user_id, sent_at desc);
