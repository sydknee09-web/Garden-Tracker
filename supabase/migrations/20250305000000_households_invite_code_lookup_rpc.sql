-- Fix: users who are not yet in any household can't SELECT from the households
-- table (RLS only allows members to read their own household row). This creates
-- a chicken-and-egg block: you need to read the household to join it, but you
-- need to be a member to read it.
--
-- Solution: a SECURITY DEFINER function that looks up a household id by invite
-- code without going through RLS. It returns only the id — no other household
-- data is exposed to the caller.

CREATE OR REPLACE FUNCTION public.get_household_id_by_invite_code(code text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.households WHERE invite_code = code LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_household_id_by_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_household_id_by_invite_code(text) TO service_role;
