-- Directories: nested structure for organizing tasks
create table if not exists public.directories (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  parent_id uuid references public.directories(id) on delete cascade,
  position integer not null default 0,
  depth_level integer not null default 0,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_directories_user_id on public.directories(user_id);
create index if not exists idx_directories_parent_id on public.directories(parent_id);

alter table public.directories enable row level security;

create policy "Users can manage own directories"
  on public.directories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
