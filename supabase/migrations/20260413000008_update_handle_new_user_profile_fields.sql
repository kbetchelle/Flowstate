-- Update handle_new_user() to populate profile fields from signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id,
    username,
    first_name,
    last_name,
    contact_email,
    date_of_birth
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'contact_email',
    case
      when new.raw_user_meta_data->>'date_of_birth' is not null
      then (new.raw_user_meta_data->>'date_of_birth')::date
      else null
    end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
