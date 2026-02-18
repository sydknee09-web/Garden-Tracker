-- Household improvements:
--   1. Atomic create_household_with_owner() RPC – eliminates orphaned-household risk
--   2. household_owner_self_member INSERT policy – tightly-scoped belt-and-suspenders
--   3. get_household_member_emails() – SECURITY DEFINER with caller-membership guard

-- ============================================================
-- 1. Atomic household creation RPC
--    Creates the household row AND the owner member row in a
--    single transaction. Either both commit or neither does.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_household_with_owner(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.households (name, owner_id)
  VALUES (p_name, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (v_id, auth.uid(), 'owner');

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_household_with_owner(text) TO authenticated;

-- ============================================================
-- 2. Belt-and-suspenders INSERT policy for owner self-member
--    Scoped to user_id = auth.uid() so User A cannot use this
--    policy to insert User B into any household.
-- ============================================================
DROP POLICY IF EXISTS "household_owner_self_member" ON public.household_members;
CREATE POLICY "household_owner_self_member" ON public.household_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    household_id IN (
      SELECT id FROM public.households WHERE owner_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Secure member email lookup
--    Returns emails only when the calling user is themselves
--    a member of the requested household. The EXISTS guard
--    prevents any authenticated user from passing an arbitrary
--    household_id to scrape emails.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_household_member_emails(p_household_id uuid)
RETURNS TABLE (user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT hm.user_id, u.email
  FROM public.household_members hm
  JOIN auth.users u ON u.id = hm.user_id
  WHERE hm.household_id = p_household_id
    AND EXISTS (
      SELECT 1 FROM public.household_members
      WHERE user_id = auth.uid()
        AND household_id = p_household_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_household_member_emails(uuid) TO authenticated;

-- ============================================================
-- 4. Household-peer SELECT policies for journal_entries, tasks,
--    and grow_instances so Family view works in those pages.
--    Read-only — writes remain gated by each table's existing
--    FOR ALL / INSERT policy scoped to auth.uid().
-- ============================================================
DROP POLICY IF EXISTS "household_journal_entries_select" ON public.journal_entries;
CREATE POLICY "household_journal_entries_select" ON public.journal_entries
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));

DROP POLICY IF EXISTS "household_tasks_select" ON public.tasks;
CREATE POLICY "household_tasks_select" ON public.tasks
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));

DROP POLICY IF EXISTS "household_grow_instances_select" ON public.grow_instances;
CREATE POLICY "household_grow_instances_select" ON public.grow_instances
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));
