-- Billing: campus plan value, Stripe status fields, pause/refund bookkeeping, .edu verification fields.
alter type plan_kind add value if not exists 'campus';

alter table public.subscriptions
  add column if not exists status text not null default 'none',          -- none | active | trialing | past_due | canceled | paused
  add column if not exists cancel_at timestamptz,                           -- Pro: cancel at period end (got hired)
  add column if not exists started_at timestamptz,                          -- first paid date, drives the 7-day refund window
  add column if not exists stripe_price_id text,
  add column if not exists campus_id uuid references public.campuses(id) on delete set null;

alter table public.profiles
  add column if not exists edu_email text,                                  -- school email used for the student price when the login email is not .edu
  add column if not exists edu_verified_at timestamptz;

-- Every checkout attempt and portal visit; joins with paywall_events for the funnel.
create table if not exists public.billing_events (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null,                                                        -- checkout_started | checkout_completed | subscription_updated | subscription_deleted | portal_opened | pause | refund_requested
  plan text, student boolean, stripe_id text, payload jsonb,
  created_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
create policy "own billing events read" on public.billing_events for select using (auth.uid() = user_id);

-- Webhook idempotency.
create table if not exists public.stripe_events (
  id text primary key,                                                       -- Stripe event id
  type text not null,
  received_at timestamptz not null default now()
);
