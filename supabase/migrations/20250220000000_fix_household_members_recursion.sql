-- Fix: infinite recursion in hm_read policy.
-- The policy "household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())"
-- causes recursion because reading household_members triggers the same policy.
-- Use my_household_ids() (SECURITY DEFINER) which bypasses RLS when reading.

-- Ensure helper exists first (from phase9/fix migration)
CREATE OR REPLACE FUNCTION my_household_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid();
$$;

-- Replace hm_read with policy that uses the function (no self-reference)
DROP POLICY IF EXISTS "hm_read" ON household_members;
CREATE POLICY "hm_read" ON household_members
  FOR SELECT USING (
    household_id IN (SELECT my_household_ids())
  );
