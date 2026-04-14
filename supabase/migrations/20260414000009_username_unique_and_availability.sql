-- Enforce unique usernames now that new accounts use real emails for auth.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (username);

-- RPC function for checking username availability without exposing profile data.
CREATE OR REPLACE FUNCTION public.is_username_taken(check_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE username = check_username);
$$;
