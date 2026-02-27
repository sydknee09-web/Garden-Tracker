-- Add 'block' to household_page_permissions.access_level.
-- Block = explicit deny; has_page_view_access and has_page_edit_access already
-- exclude block by only matching access_level IN ('view','edit').

ALTER TABLE public.household_page_permissions
  DROP CONSTRAINT IF EXISTS household_page_permissions_access_level_check;

ALTER TABLE public.household_page_permissions
  ADD CONSTRAINT household_page_permissions_access_level_check
  CHECK (access_level IN ('view','edit','block'));
