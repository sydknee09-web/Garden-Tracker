-- Household page permissions: per-page view/edit access for family members.
--
-- Adds:
--   1. household_page_permissions table — grantor approves view or edit per page per grantee
--   2. RLS policies on household_page_permissions
--   3. has_page_view_access(owner_id, page) and has_page_edit_access(owner_id, page) — SECURITY DEFINER
--   4. household_shopping_list_select — so family view can include shopping list

-- ============================================================
-- 1. household_page_permissions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.household_page_permissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  grantor_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grantee_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page             text NOT NULL CHECK (page IN ('seed_vault','plant_vault','garden','journal','shed','shopping_list')),
  access_level     text NOT NULL CHECK (access_level IN ('view','edit')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(grantor_user_id, grantee_user_id, page)
);

CREATE INDEX IF NOT EXISTS idx_household_page_permissions_household ON public.household_page_permissions(household_id);
CREATE INDEX IF NOT EXISTS idx_household_page_permissions_grantee ON public.household_page_permissions(grantee_user_id);

ALTER TABLE public.household_page_permissions ENABLE ROW LEVEL SECURITY;

-- Both parties can see their own permissions
CREATE POLICY "page_perms_select" ON public.household_page_permissions
  FOR SELECT USING (grantor_user_id = auth.uid() OR grantee_user_id = auth.uid());

-- Only the grantor can create their own permissions
CREATE POLICY "page_perms_insert" ON public.household_page_permissions
  FOR INSERT WITH CHECK (grantor_user_id = auth.uid());

-- Only the grantor can update/delete their own permissions
CREATE POLICY "page_perms_update" ON public.household_page_permissions
  FOR UPDATE USING (grantor_user_id = auth.uid());

CREATE POLICY "page_perms_delete" ON public.household_page_permissions
  FOR DELETE USING (grantor_user_id = auth.uid());

-- ============================================================
-- 2. has_page_view_access(owner_id, page) — SECURITY DEFINER
--    Returns true if the current user can VIEW data owned by owner_id for the given page.
--    Logic: own data OR (household peer AND (page permission view/edit OR legacy edit_grant))
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_page_view_access(owner_id uuid, p_page text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    owner_id = auth.uid()
    OR (
      -- Same household
      EXISTS (
        SELECT 1 FROM public.household_members hm1
        JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
        WHERE hm1.user_id = auth.uid() AND hm2.user_id = owner_id
      )
      AND (
        -- Legacy edit grant = full access
        EXISTS (
          SELECT 1 FROM public.household_edit_grants
          WHERE grantor_user_id = owner_id AND grantee_user_id = auth.uid()
        )
        OR
        -- Page permission view or edit
        EXISTS (
          SELECT 1 FROM public.household_page_permissions
          WHERE grantor_user_id = owner_id
            AND grantee_user_id = auth.uid()
            AND page = p_page
            AND access_level IN ('view','edit')
        )
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.has_page_view_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_page_view_access(uuid, text) TO service_role;

-- ============================================================
-- 3. has_page_edit_access(owner_id, page) — SECURITY DEFINER
--    Returns true if the current user can EDIT data owned by owner_id for the given page.
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_page_edit_access(owner_id uuid, p_page text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    owner_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM public.household_members hm1
        JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
        WHERE hm1.user_id = auth.uid() AND hm2.user_id = owner_id
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.household_edit_grants
          WHERE grantor_user_id = owner_id AND grantee_user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM public.household_page_permissions
          WHERE grantor_user_id = owner_id
            AND grantee_user_id = auth.uid()
            AND page = p_page
            AND access_level = 'edit'
        )
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.has_page_edit_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_page_edit_access(uuid, text) TO service_role;

-- ============================================================
-- 4. household_shopping_list_select — family view can read shopping lists
-- ============================================================
DROP POLICY IF EXISTS "household_shopping_list_select" ON public.shopping_list;
CREATE POLICY "household_shopping_list_select" ON public.shopping_list
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));
