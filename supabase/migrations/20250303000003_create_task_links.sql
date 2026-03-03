-- Task links: dependencies/references between tasks
create table if not exists public.task_links (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.tasks(id) on delete cascade,
  target_id uuid not null references public.tasks(id) on delete cascade,
  link_type text not null default 'reference' check (link_type in ('reference', 'dependency')),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, target_id, link_type)
);

create index if not exists idx_task_links_user_id on public.task_links(user_id);
create index if not exists idx_task_links_source_id on public.task_links(source_id);
create index if not exists idx_task_links_target_id on public.task_links(target_id);

alter table public.task_links enable row level security;

create policy "Users can manage own task links"
  on public.task_links
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
