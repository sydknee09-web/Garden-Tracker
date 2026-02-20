-- Fix: infinite recursion on household_members INSERT.
--
-- The old "hm_insert" policy (from phase9/fix migrations) contains:
--   SELECT hm.household_id FROM household_members hm WHERE hm.user_id = auth.uid()
-- which reads household_members through RLS while already evaluating a policy
-- on household_members — causing infinite recursion.
--
-- "hm_self_join" (added in 20250301) handles the invite-code join flow but
-- hm_insert was never dropped, so BOTH policies run on every INSERT.
--
-- Fix: drop hm_insert and replace it with a non-recursive owner-insert policy
-- that only queries the households table (no self-reference).

DROP POLICY IF EXISTS "hm_insert" ON public.household_members;

-- Owners can directly add members to their household (no recursion: queries
-- households.owner_id only, which is handled by the household_owner_all policy).
DROP POLICY IF EXISTS "hm_insert_owner" ON public.household_members;
CREATE POLICY "hm_insert_owner" ON public.household_members
  FOR INSERT WITH CHECK (
    household_id IN (SELECT id FROM public.households WHERE owner_id = auth.uid())
  );

-- Helper: check if a household has an invite code without going through
-- households RLS (a non-member can't SELECT from households at all).
CREATE OR REPLACE FUNCTION public.household_has_invite_code(hid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households WHERE id = hid AND invite_code IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.household_has_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.household_has_invite_code(uuid) TO service_role;

-- Recreate hm_self_join using the SECURITY DEFINER function so the households
-- check doesn't go through RLS (which would block non-members).
DROP POLICY IF EXISTS "hm_self_join" ON public.household_members;
CREATE POLICY "hm_self_join" ON public.household_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    public.household_has_invite_code(household_id)
  );
