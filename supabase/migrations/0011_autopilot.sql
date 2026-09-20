-- Autopilot: overnight prep queue. One row per user+job per night it was picked.
create table if not exists public.autopilot_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  night date not null default current_date,
  fit int not null,
  status text not null default 'previewed',     -- previewed (Free: shown, not prepared) | prepared | approved | dismissed | applied
  resume_id uuid references public.resumes(id) on delete set null,
  coverage int,                                 -- keyword coverage after tailoring
  prepared_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);
alter table public.autopilot_queue enable row level security;
create policy "own autopilot queue" on public.autopilot_queue for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists autopilot_queue_user_night on public.autopilot_queue (user_id, night desc, status);

alter table public.profiles
  add column if not exists autopilot_enabled boolean not null default true,
  add column if not exists autopilot_min_fit int not null default 80;
