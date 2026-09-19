-- Rails schema v0. Apply with: supabase db push  (or paste into the SQL editor).
create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------- enums ----------
create type ats_kind as enum ('greenhouse','lever','ashby','smartrecruiters','workday','usajobs','icims','oracle','workable','jobvite','taleo','unknown');
create type plan_kind as enum ('free','pro','semester');
create type app_stage as enum ('saved','prepared','applied','viewed','oa','interview','offer','rejected','withdrawn');
create type app_via as enum ('rails_autofill','rails_autopilot','manual','external');

-- ---------- users / profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  state text,                                  -- 2-letter; CA/NY gated at signup
  edu_verified boolean not null default false, -- .edu -> student price
  school text,
  program text,
  campus_id uuid,                              -- career-center pilot campus, nullable
  canonical jsonb,                             -- CanonicalProfile (src/lib/schemas/profile.ts)
  canonical_version int not null default 0,
  forwarding_alias text unique,                -- maya-4k2@in.rails.app
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('base','tailored')),
  job_id uuid,                                 -- set for tailored
  storage_path text,                           -- supabase storage
  text_content text,
  score int check (score between 0 and 100),
  score_breakdown jsonb,
  diff jsonb,                                  -- tailored: [{line, source:'resume'|'user', from}]
  created_at timestamptz not null default now()
);

-- ---------- jobs ----------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ats ats_kind not null default 'unknown',
  slug text,
  tenant text, wdn int,                        -- workday
  careers_url text,
  hires_from_schools text[] not null default '{}',
  sponsors_clearance boolean,
  active boolean not null default true,
  last_polled_at timestamptz,
  last_poll_ok boolean,
  last_error text,
  created_at timestamptz not null default now(),
  unique (ats, slug, tenant)
);
create index companies_name_trgm on public.companies using gin (name gin_trgm_ops);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ats ats_kind not null,
  external_id text not null,
  title text not null,
  location text,
  remote boolean,
  employment_type text,
  department text,
  description_html text,
  description_text text,
  url text not null,
  apply_url text not null,
  posted_at timestamptz,
  pay_min numeric, pay_max numeric, pay_currency text, pay_period text,
  tags jsonb,                                  -- JobTags (src/lib/jobs/tags.ts)
  tagged_at timestamptz,
  embedding vector(1536),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_verified_at timestamptz,
  closed_at timestamptz,                       -- set by the verifier
  source text not null default 'feed' check (source in ('feed','paste')),
  unique (company_id, external_id)
);
create index jobs_open_posted on public.jobs (posted_at desc) where closed_at is null;
create index jobs_tags_gin on public.jobs using gin (tags);
create index jobs_title_trgm on public.jobs using gin (title gin_trgm_ops);

create table public.job_skills (
  job_id uuid references public.jobs(id) on delete cascade,
  skill_key text not null,
  required boolean not null,
  primary key (job_id, skill_key)
);
create index job_skills_key on public.job_skills (skill_key);

-- ---------- matches (per user per job) ----------
create table public.matches (
  user_id uuid references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  fit int not null check (fit between 0 and 100),
  band text not null check (band in ('strong','good','stretch')),
  sub jsonb not null,                          -- {experience, skills, field}
  hard_blocks text[] not null default '{}',
  requirements jsonb,                          -- RequirementCheck[]
  liked boolean not null default false,
  hidden boolean not null default false,
  canonical_version int not null,
  scored_at timestamptz not null default now(),
  primary key (user_id, job_id)
);
create index matches_feed on public.matches (user_id, fit desc) where hidden = false;

-- ---------- applications / tracker ----------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  title text not null, company_name text not null, url text,
  stage app_stage not null default 'saved',
  via app_via not null default 'manual',
  resume_id uuid references public.resumes(id) on delete set null,
  cover_letter text,
  applied_at timestamptz,
  last_activity_at timestamptz not null default now(),
  next_action text, next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index applications_user_stage on public.applications (user_id, stage);

create table public.application_events (
  id bigserial primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  kind text not null,                          -- 'stage_change','email_in','note','reminder'
  from_stage app_stage, to_stage app_stage,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ---------- autofill telemetry (the flywheel) ----------
create table public.fill_events (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  domain text not null,
  ats ats_kind not null,
  page_url_hash text,
  field_key text not null,                     -- canonical profile key, e.g. 'phone'
  selector text,
  strategy text not null,                      -- 'autocomplete','name','label','placeholder','llm','learned'
  success boolean not null,
  created_at timestamptz not null default now()
);
create index fill_events_domain on public.fill_events (domain, field_key, success);

create table public.learned_selectors (
  domain text not null, field_key text not null, selector text not null,
  hits int not null default 1, misses int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (domain, field_key, selector)
);

-- ---------- billing ----------
create table public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan plan_kind not null default 'free',
  student_price boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  paused_until timestamptz,                    -- "got the job" pause
  referred_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.usage_daily (
  user_id uuid references public.profiles(id) on delete cascade,
  day date not null default current_date,
  tailors int not null default 0,
  letters int not null default 0,
  primary key (user_id, day)
);

-- ---------- career centers ----------
create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null, school text not null,
  edu_domain text not null,                    -- 'email.vccs.edu'
  pilot_until date,
  created_at timestamptz not null default now()
);
create table public.campus_staff (
  campus_id uuid references public.campuses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'counselor',
  primary key (campus_id, user_id)
);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.matches enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.fill_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_daily enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.job_skills enable row level security;
alter table public.learned_selectors enable row level security;
alter table public.campuses enable row level security;
alter table public.campus_staff enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own resumes" on public.resumes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own matches" on public.matches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own applications" on public.applications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own application events" on public.application_events for all
  using (exists (select 1 from public.applications a where a.id = application_id and a.user_id = auth.uid()));
create policy "own fill events insert" on public.fill_events for insert with check (auth.uid() = user_id);
create policy "own subscription read" on public.subscriptions for select using (auth.uid() = user_id);
create policy "own usage" on public.usage_daily for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- jobs are public reads for signed-in users; writes only via service role (poller)
create policy "jobs read" on public.jobs for select using (auth.role() = 'authenticated');
create policy "companies read" on public.companies for select using (auth.role() = 'authenticated');
create policy "job_skills read" on public.job_skills for select using (auth.role() = 'authenticated');
create policy "learned selectors read" on public.learned_selectors for select using (auth.role() = 'authenticated');
-- campus staff see aggregate views (defined below), never raw profiles
create policy "campus staff self" on public.campus_staff for select using (auth.uid() = user_id);
create policy "campus read" on public.campuses for select using (exists (select 1 from public.campus_staff s where s.campus_id = id and s.user_id = auth.uid()));

-- ---------- profile bootstrap on signup ----------
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, edu_verified)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email ilike '%.edu');
  insert into public.subscriptions (user_id, plan, student_price) values (new.id, 'free', new.email ilike '%.edu');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- ---------- interview rate (the headline metric) ----------
create or replace view public.user_funnel as
select user_id,
  count(*) filter (where stage <> 'saved') as applied,
  count(*) filter (where stage in ('viewed','oa','interview','offer')) as viewed,
  count(*) filter (where stage in ('oa','interview','offer')) as oa,
  count(*) filter (where stage in ('interview','offer')) as interviews,
  count(*) filter (where stage = 'offer') as offers,
  round(100.0 * count(*) filter (where stage in ('interview','offer')) / nullif(count(*) filter (where stage <> 'saved'), 0), 1) as interview_rate
from public.applications group by user_id;

-- campus aggregate for the career-center dashboard: counts only, no names unless the student is flagged (done in app code with service role)
create or replace view public.campus_funnel as
select p.campus_id, p.program,
  count(distinct p.id) as students,
  sum(f.applied) as applied, sum(f.interviews) as interviews, sum(f.offers) as offers,
  round(100.0 * sum(f.interviews) / nullif(sum(f.applied), 0), 1) as interview_rate
from public.profiles p left join public.user_funnel f on f.user_id = p.id
where p.campus_id is not null group by p.campus_id, p.program;

-- ---------- updated_at ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute procedure public.touch_updated_at();
