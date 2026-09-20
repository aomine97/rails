-- Waitlist for gated states, and store the signup state on the profile.
create table public.waitlist (
  email text primary key,
  state text,
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security; -- service role only

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, state, edu_verified)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), new.raw_user_meta_data->>'state', new.email ilike '%.edu');
  insert into public.subscriptions (user_id, plan, student_price) values (new.id, 'free', new.email ilike '%.edu');
  insert into public.credits (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
