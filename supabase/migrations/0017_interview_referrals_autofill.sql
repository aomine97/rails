-- Mock interview (9) + OA drills; Referrals (10); Autofill settings (15).
create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  title text not null,
  company text,
  mode text not null check (mode in ('phone', 'technical', 'behavioral')),
  questions jsonb not null,                    -- [{q, kind, why}]
  created_at timestamptz not null default now()
);
create table if not exists public.interview_answers (
  id bigserial primary key,
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  q_index int not null,
  answer text not null,
  feedback jsonb,                              -- {score, keep[], cut[], tighten[], stronger, fillers}
  score int check (score between 0 and 10),
  saved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists interview_answers_session on public.interview_answers (session_id, q_index, created_at desc);
create table if not exists public.oa_drills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  drill jsonb not null,                        -- {title, prompt, examples, constraints, hints, approach, language, minutes}
  code text,
  review jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.referral_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  name text not null,
  role text,
  link text,
  relation text not null default 'other' check (relation in ('alum', 'recruiter', 'team', 'other')),
  channel text not null default 'linkedin' check (channel in ('linkedin', 'email', 'other')),
  status text not null default 'to_ask' check (status in ('to_ask', 'asked', 'replied', 'referred', 'no_reply')),
  draft text,
  drafted_at timestamptz,
  asked_at timestamptz,
  next_nudge_at timestamptz,
  notes text,
  job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists referral_contacts_user on public.referral_contacts (user_id, created_at desc);

alter table public.profiles add column if not exists autofill_prefs jsonb not null default '{}'::jsonb;

alter table public.interview_sessions enable row level security;
alter table public.interview_answers enable row level security;
alter table public.oa_drills enable row level security;
alter table public.referral_contacts enable row level security;
create policy "interview own" on public.interview_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "answers own" on public.interview_answers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "oa own" on public.oa_drills for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "referrals own" on public.referral_contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
