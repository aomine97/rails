-- Nightly bulk tagging via the Anthropic Message Batches API.
create table if not exists public.tag_batches (
  id text primary key,                       -- msgbatch_...
  status text not null default 'in_progress',-- in_progress | ended (results partly applied) | done
  submitted int not null default 0,
  tagged int not null default 0,
  failed int not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.tag_batches enable row level security;

alter table public.jobs add column if not exists tag_batch_id text;
create index if not exists jobs_untagged_batch on public.jobs (first_seen_at desc) where tagged_at is null and closed_at is null;
