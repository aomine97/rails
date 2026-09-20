-- AI credits for the free tier: 3 credits, lazy refill every 72h from first spend.
create table public.credits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance int not null default 3 check (balance >= 0),
  refill_at timestamptz,                       -- null until first spend
  updated_at timestamptz not null default now()
);
alter table public.credits enable row level security;
create policy "own credits read" on public.credits for select using (auth.uid() = user_id);

create table public.credit_events (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('tailor','cover_letter','mock_interview','refill','grant')),
  delta int not null,
  ref_id uuid,                                 -- job or resume id
  created_at timestamptz not null default now()
);
alter table public.credit_events enable row level security;
create policy "own credit events read" on public.credit_events for select using (auth.uid() = user_id);

-- Coach messages/day and referral reveals/day for free users live in usage_daily
alter table public.usage_daily add column if not exists coach_messages int not null default 0;
alter table public.usage_daily add column if not exists referral_reveals int not null default 0;
alter table public.usage_daily add column if not exists resume_scores int not null default 0;

-- Paywall impressions: which moment converted (so we can rank the six moments with data)
create table public.paywall_events (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  reason text not null,                        -- 'tailor_locked','autopilot_preview','fit_gap','momentum','first_reply','founding_price'
  action text not null check (action in ('shown','dismissed','clicked','converted')),
  created_at timestamptz not null default now()
);
alter table public.paywall_events enable row level security;
create policy "own paywall events insert" on public.paywall_events for insert with check (auth.uid() = user_id);

-- bootstrap credits with the profile
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, edu_verified)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email ilike '%.edu');
  insert into public.subscriptions (user_id, plan, student_price) values (new.id, 'free', new.email ilike '%.edu');
  insert into public.credits (user_id) values (new.id);
  return new;
end $$;

-- Spend a credit atomically. Returns the new balance, or -1 when empty. Applies the lazy refill first.
create or replace function public.spend_credit(p_user uuid, p_kind text, p_ref uuid default null) returns int language plpgsql security definer set search_path = public as $$
declare c public.credits; new_balance int;
begin
  select * into c from public.credits where user_id = p_user for update;
  if not found then insert into public.credits (user_id) values (p_user) returning * into c; end if;
  if c.refill_at is not null and c.refill_at <= now() then
    update public.credits set balance = 3, refill_at = null, updated_at = now() where user_id = p_user returning * into c;
    insert into public.credit_events (user_id, kind, delta) values (p_user, 'refill', 3 - c.balance);
  end if;
  if c.balance <= 0 then return -1; end if;
  new_balance := c.balance - 1;
  update public.credits set balance = new_balance, refill_at = coalesce(refill_at, now() + interval '72 hours'), updated_at = now() where user_id = p_user;
  insert into public.credit_events (user_id, kind, delta, ref_id) values (p_user, p_kind, -1, p_ref);
  return new_balance;
end $$;
