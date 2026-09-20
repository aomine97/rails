-- Chrome extension pairing: a per-user bearer token, rotated from /ext/connect.
alter table public.profiles add column if not exists ext_token text unique, add column if not exists ext_connected_at timestamptz;
create index if not exists fill_events_user on public.fill_events (user_id, created_at desc);
