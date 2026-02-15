-- Fix: "infinite recursion detected in policy for relation household_members"
-- Policies that SELECT from household_members while evaluating RLS on household_members
-- cause recursion. Use my_household_ids() (SECURITY DEFINER) everywhere so we never
-- read household_members through RLS when evaluating these policies.

-- 1. Ensure helper exists and bypasses RLS
CREATE OR REPLACE FUNCTION public.my_household_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid();
$$;

-- Allow authenticated users to call it from RLS
GRANT EXECUTE ON FUNCTION public.my_household_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_household_ids() TO service_role;

-- 2. household_members: hm_read must not reference household_members
DROP POLICY IF EXISTS "hm_read" ON public.household_members;
CREATE POLICY "hm_read" ON public.household_members
  FOR SELECT
  USING (household_id IN (SELECT public.my_household_ids()));

-- 3. households: household_members_read should not query household_members via RLS
DROP POLICY IF EXISTS "household_members_read" ON public.households;
CREATE POLICY "household_members_read" ON public.households
  FOR SELECT
  USING (id IN (SELECT public.my_household_ids()));
