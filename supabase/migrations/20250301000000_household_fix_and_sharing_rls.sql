-- Fix household RLS bugs and add family sharing policies.
--
-- Fixes:
--   1. Re-applies my_household_ids() SECURITY DEFINER to guarantee it is live.
--   2. Recreates hm_read to use the helper (stops infinite recursion on SELECT).
--   3. Adds hm_self_join so a user can insert themselves via a valid invite code
--      (the previous hm_insert policy only allowed owners/admins to add members,
--      creating a chicken-and-egg block for the "Join" flow).
--   4. Adds my_household_member_user_ids() SECURITY DEFINER helper.
--   5. Adds household-peer SELECT policies on plant_profiles and seed_packets
--      so family-view queries can read each other's vault data (read-only).

-- ============================================================
-- 1. Ensure my_household_ids() exists and bypasses RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_household_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.my_household_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_household_ids() TO service_role;

-- ============================================================
-- 2. Fix hm_read — no self-referential SELECT through RLS
-- ============================================================
DROP POLICY IF EXISTS "hm_read" ON public.household_members;
CREATE POLICY "hm_read" ON public.household_members
  FOR SELECT
  USING (household_id IN (SELECT public.my_household_ids()));

-- Keep household_members_read on households consistent
DROP POLICY IF EXISTS "household_members_read" ON public.households;
CREATE POLICY "household_members_read" ON public.households
  FOR SELECT
  USING (id IN (SELECT public.my_household_ids()));

-- ============================================================
-- 3. Allow self-join via invite code
--    Any authenticated user can insert a row for themselves into a
--    household that has a non-null invite_code.
-- ============================================================
DROP POLICY IF EXISTS "hm_self_join" ON public.household_members;
CREATE POLICY "hm_self_join" ON public.household_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    household_id IN (SELECT id FROM public.households WHERE invite_code IS NOT NULL)
  );

-- ============================================================
-- 4. Helper: all user_ids that share any household with the caller
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_household_member_user_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT user_id FROM public.household_members
  WHERE household_id IN (SELECT public.my_household_ids());
$$;

GRANT EXECUTE ON FUNCTION public.my_household_member_user_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_household_member_user_ids() TO service_role;

-- ============================================================
-- 5. plant_profiles: household peers can read each other's rows
--    (SELECT only — writes remain gated by the existing FOR ALL policy)
-- ============================================================
DROP POLICY IF EXISTS "household_profiles_select" ON public.plant_profiles;
CREATE POLICY "household_profiles_select" ON public.plant_profiles
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));

-- ============================================================
-- 6. seed_packets: same household-peer read access
-- ============================================================
DROP POLICY IF EXISTS "household_seed_packets_select" ON public.seed_packets;
CREATE POLICY "household_seed_packets_select" ON public.seed_packets
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));
