-- §3.12-tester T4 — Admin feedback inbox (un-park 🟣 → ✅).
-- Companion to T1+T2 (20260517120000) — provides the read path for the data
-- T1+T2 now collects (voice_path + debug_log_text columns on user_feedback).
--
-- Architecture: a tiny developer_users allowlist + a security-definer function
-- that bypasses user_feedback RLS only when the caller's auth.uid() is in the
-- allowlist. Function raises 42501 'Not authorized' for non-devs.
--
-- One-time setup (post-deploy, run once in Supabase Dashboard SQL Editor while
-- signed in as the developer):
--   INSERT INTO public.developer_users (user_id) VALUES (auth.uid());

-- Developer allowlist. No RLS policies → clients cannot read, write, update, or
-- delete via PostgREST. Only the security-definer function below reads this
-- table (as the table owner, RLS bypassed). Inserts happen via the Dashboard
-- SQL Editor (service-role context).
CREATE TABLE IF NOT EXISTS public.developer_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_users ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.developer_users IS
  'Allowlist of user_ids permitted to call admin_list_feedback(). RLS-locked (no policies) — only the security-definer function reads this. Insert via Dashboard SQL Editor.';

-- Admin viewer for user_feedback rows. Security-definer so it bypasses the
-- "users can SELECT own only" RLS policy on user_feedback. Internal gate:
-- caller's auth.uid() must be in developer_users or the function raises.
CREATE OR REPLACE FUNCTION public.admin_list_feedback()
RETURNS SETOF public.user_feedback
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.developer_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT * FROM public.user_feedback
    ORDER BY created_at DESC
    LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_feedback() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_feedback() TO service_role;

COMMENT ON FUNCTION public.admin_list_feedback() IS
  '§3.12-tester T4 admin viewer. Returns up to 200 most recent user_feedback rows for callers in developer_users; raises 42501 otherwise.';
