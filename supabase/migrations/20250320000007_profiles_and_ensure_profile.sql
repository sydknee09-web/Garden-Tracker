-- Ensure every authenticated user has a profile row so login and mountain create work.
-- Fixes "login hasnt worked" / "Couldn't save" (FK 23503) when profiles row was missing.
--
-- 1. Create profiles table if missing (some projects create it via dashboard).
-- 2. Trigger: insert profile on auth.users INSERT so sign-up always gets a row.
-- 3. RPC: ensure_profile() as fallback for existing users created before this migration.

-- Profiles table (id matches auth.users.id). Create if missing.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  has_seen_elias_intro BOOLEAN NOT NULL DEFAULT FALSE,
  display_name TEXT
);

-- Ensure columns exist if table was created with only id elsewhere
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_seen_elias_intro BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Trigger function: insert one row into public.profiles when a new user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, has_seen_elias_intro, display_name)
  VALUES (NEW.id, FALSE, NULL)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger: run after each insert on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RPC: ensure current user has a profile row (for users created before this migration)
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, has_seen_elias_intro, display_name)
  VALUES (auth.uid(), FALSE, NULL)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Allow authenticated clients to call ensure_profile (e.g. profile gate, mountain create)
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;
