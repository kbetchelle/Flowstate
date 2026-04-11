-- User profiles: display name, contact email, personal details.
-- username is read-only after creation (it is the login identifier).
-- contact_email is the user's real email, separate from the fake auth email.
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  username       text not null,
  first_name     text,
  last_name      text,
  nickname       text,
  contact_email  text,
  date_of_birth  date,
  gender         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can manage own profile"
  on public.profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-create a profile row when a new auth user is created.
-- Reads username from raw_user_meta_data set during signUp via options.data.username.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for users who signed up before this migration.
insert into public.profiles (user_id, username)
select
  id,
  coalesce(raw_user_meta_data->>'username', split_part(email, '@', 1))
from auth.users
on conflict (user_id) do nothing;
