-- Action history for undo
create table if not exists public.action_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  payload jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_action_history_user_id on public.action_history(user_id);
create index if not exists idx_action_history_created_at on public.action_history(created_at desc);

alter table public.action_history enable row level security;

create policy "Users can manage own action history"
  on public.action_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
