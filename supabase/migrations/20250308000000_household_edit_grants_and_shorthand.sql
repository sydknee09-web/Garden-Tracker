-- Household edit grants + display shorthand
--
-- Adds:
--   1. user_settings.display_shorthand  — 1-4 char badge shown in family view
--   2. household_edit_grants table      — who can edit whose plants & tasks
--   3. has_edit_grant_from() function   — SECURITY DEFINER, used in RLS
--   4. Updated FOR ALL policies on tasks/grow_instances/journal_entries/seed_packets
--      to also allow writes when a valid edit grant exists
--   5. household SELECT policy on user_settings so members can read each other's shorthand

-- ============================================================
-- 1. display_shorthand column
-- ============================================================
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS display_shorthand text
  CONSTRAINT display_shorthand_length CHECK (char_length(display_shorthand) BETWEEN 1 AND 4);

-- ============================================================
-- 2. household_edit_grants table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.household_edit_grants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  grantor_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grantee_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(grantor_user_id, grantee_user_id)
);

ALTER TABLE public.household_edit_grants ENABLE ROW LEVEL SECURITY;

-- Both parties can see their own grants
CREATE POLICY "grants_select" ON public.household_edit_grants
  FOR SELECT USING (grantor_user_id = auth.uid() OR grantee_user_id = auth.uid());

-- Only the grantor can create their own grants
CREATE POLICY "grants_insert" ON public.household_edit_grants
  FOR INSERT WITH CHECK (grantor_user_id = auth.uid());

-- Only the grantor can revoke their own grants
CREATE POLICY "grants_delete" ON public.household_edit_grants
  FOR DELETE USING (grantor_user_id = auth.uid());

-- ============================================================
-- 3. has_edit_grant_from() — SECURITY DEFINER
--    Returns true if the current user has been granted edit
--    access by owner_id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_edit_grant_from(owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_edit_grants
    WHERE grantor_user_id = owner_id
      AND grantee_user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_edit_grant_from(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_edit_grant_from(uuid) TO service_role;

-- ============================================================
-- 4. Update write policies on tables covered by edit grants
--    DROP old policy, CREATE new one that also allows writes
--    when has_edit_grant_from(user_id) is true.
-- ============================================================

-- tasks
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
CREATE POLICY "tasks_manage_with_grant" ON public.tasks
  FOR ALL
  USING (user_id = auth.uid() OR public.has_edit_grant_from(user_id))
  WITH CHECK (user_id = auth.uid() OR public.has_edit_grant_from(user_id));

-- grow_instances
DROP POLICY IF EXISTS "Users can manage own grow_instances" ON public.grow_instances;
CREATE POLICY "grow_instances_manage_with_grant" ON public.grow_instances
  FOR ALL
  USING (user_id = auth.uid() OR public.has_edit_grant_from(user_id))
  WITH CHECK (user_id = auth.uid() OR public.has_edit_grant_from(user_id));

-- journal_entries
DROP POLICY IF EXISTS "Users can manage own journal_entries" ON public.journal_entries;
CREATE POLICY "journal_entries_manage_with_grant" ON public.journal_entries
  FOR ALL
  USING (user_id = auth.uid() OR public.has_edit_grant_from(user_id))
  WITH CHECK (user_id = auth.uid() OR public.has_edit_grant_from(user_id));

-- seed_packets
DROP POLICY IF EXISTS "Users can manage own seed_packets" ON public.seed_packets;
CREATE POLICY "seed_packets_manage_with_grant" ON public.seed_packets
  FOR ALL
  USING (user_id = auth.uid() OR public.has_edit_grant_from(user_id))
  WITH CHECK (user_id = auth.uid() OR public.has_edit_grant_from(user_id));

-- ============================================================
-- 5. Allow household members to read each other's user_settings
--    (needed to load display_shorthand for the badge)
-- ============================================================
DROP POLICY IF EXISTS "household_user_settings_select" ON public.user_settings;
CREATE POLICY "household_user_settings_select" ON public.user_settings
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));
