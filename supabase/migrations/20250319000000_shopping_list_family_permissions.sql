-- Shopping list: permission-aware RLS for family view.
-- Replaces broad household_shopping_list_select with has_page_view_access.
-- Adds household_shopping_list_update so family members with edit permission can mark items purchased.

-- ============================================================
-- 1. Replace SELECT policy: use has_page_view_access (honors view/edit/block)
-- ============================================================
DROP POLICY IF EXISTS "household_shopping_list_select" ON public.shopping_list;
CREATE POLICY "household_shopping_list_select" ON public.shopping_list
  FOR SELECT
  USING (public.has_page_view_access(user_id, 'shopping_list'));

-- ============================================================
-- 2. Add UPDATE policy: family members with edit permission can mark purchased
-- ============================================================
DROP POLICY IF EXISTS "household_shopping_list_update" ON public.shopping_list;
CREATE POLICY "household_shopping_list_update" ON public.shopping_list
  FOR UPDATE
  USING (public.has_page_edit_access(user_id, 'shopping_list'));
