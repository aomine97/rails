-- Career center dashboard (16) + campus plan.
-- 1. Campus plan: students whose school email matches a campus get Pro while the campus is in its pilot or paid term.
alter table public.campuses
  add column if not exists paid_until date,
  add column if not exists active boolean not null default true,
  add column if not exists contact_email text;

-- Students can opt out of being named to counselors (aggregates still count them).
alter table public.profiles add column if not exists campus_share boolean not null default true;

-- Assign campus by email domain on every insert/update, so campus_id can't be set by hand through the API.
-- Longest domain wins (email.vccs.edu over vccs.edu).
create or replace function public.assign_campus() returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select c.id into cid from public.campuses c
   where c.active and (lower(coalesce(new.email, '')) like '%@' || lower(c.edu_domain) or lower(coalesce(new.edu_email, '')) like '%@' || lower(c.edu_domain))
   order by length(c.edu_domain) desc limit 1;
  new.campus_id := cid;
  return new;
end $$;
drop trigger if exists profiles_assign_campus on public.profiles;
create trigger profiles_assign_campus before insert or update on public.profiles for each row execute procedure public.assign_campus();

-- Is this user's campus plan live? Only answers for yourself (or the service role).
create or replace function public.campus_active(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p join public.campuses c on c.id = p.campus_id
     where p.id = p_user and (p_user = auth.uid() or auth.role() = 'service_role')
       and c.active and greatest(coalesce(c.pilot_until, date '1970-01-01'), coalesce(c.paid_until, date '1970-01-01')) >= current_date)
$$;
grant execute on function public.campus_active(uuid) to authenticated, service_role;

-- 2. Pilot requests from /career-centers (written by the server with the service role).
create table if not exists public.campus_requests (
  id bigserial primary key,
  name text not null, email text not null, school text not null, role text, students text, note text,
  created_at timestamptz not null default now()
);
alter table public.campus_requests enable row level security;

-- 3. The 0001 funnel views ran with the owner's rights, which let any signed-in user read every user's counts.
alter view public.user_funnel set (security_invoker = true);
alter view public.campus_funnel set (security_invoker = true);
revoke all on public.user_funnel, public.campus_funnel from anon;
