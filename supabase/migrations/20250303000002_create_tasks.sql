-- Task status and priority enums per spec §4
create type public.task_priority as enum ('LOW', 'MED', 'HIGH');
create type public.task_status as enum ('not_started', 'in_progress', 'finishing_touches', 'completed');

-- Tasks: all fields from spec §4 (no time_entries / timer)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  directory_id uuid references public.directories(id) on delete cascade,
  priority public.task_priority not null default 'MED',
  start_date date,
  due_date date,
  background_color text,
  category text,
  tags text[] default '{}',
  description text default '',
  is_completed boolean not null default false,
  completed_at timestamptz,
  status public.task_status not null default 'not_started',
  archived_at timestamptz,
  archive_reason text,
  position integer not null default 0,
  -- Recurrence (full pattern: frequency, interval, end date per Q58)
  recurrence_frequency text,
  recurrence_interval integer,
  recurrence_end_date date,
  checklist_items jsonb default '[]',
  estimated_duration_minutes integer,
  actual_duration_minutes integer,
  url text,
  version integer not null default 1,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_directory_id on public.tasks(directory_id);
create index if not exists idx_tasks_archived_at on public.tasks(archived_at);

alter table public.tasks enable row level security;

create policy "Users can manage own tasks"
  on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
