-- Shopping list: support "wishlist" placeholders (no profile yet).
-- Placeholders: user wants a variety they don't own; "I bought this" later moves to Vault.

-- Add placeholder display fields (used when plant_profile_id is null)
ALTER TABLE public.shopping_list
  ADD COLUMN IF NOT EXISTS placeholder_name TEXT,
  ADD COLUMN IF NOT EXISTS placeholder_variety TEXT;

-- Allow rows without a profile (wishlist items)
ALTER TABLE public.shopping_list
  ALTER COLUMN plant_profile_id DROP NOT NULL;

-- Ensure at least one of profile or placeholder is set (application responsibility; no CHECK to allow legacy rows)
-- Partial unique index: one row per user per profile when profile is set; placeholders can duplicate
DROP INDEX IF EXISTS public.idx_shopping_list_user_profile;
CREATE UNIQUE INDEX idx_shopping_list_user_profile
  ON public.shopping_list (user_id, plant_profile_id)
  WHERE plant_profile_id IS NOT NULL;
