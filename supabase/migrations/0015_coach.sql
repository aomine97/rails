-- Coach (8): the conversation, per user. Answers cite the application rows they used (sources).
create table if not exists public.coach_messages (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_user on public.coach_messages (user_id, created_at desc);
alter table public.coach_messages enable row level security;
create policy "coach own read" on public.coach_messages for select using (auth.uid() = user_id);
create policy "coach own insert" on public.coach_messages for insert with check (auth.uid() = user_id);
create policy "coach own delete" on public.coach_messages for delete using (auth.uid() = user_id);
