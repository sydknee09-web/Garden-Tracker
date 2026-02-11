-- Shopping list: mark items as purchased; hide purchased from UI.
ALTER TABLE shopping_list
  ADD COLUMN IF NOT EXISTS is_purchased boolean NOT NULL DEFAULT false;

-- Allow one row per user per profile (for upsert from Vault "Add to list").
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_list_user_profile
  ON shopping_list (user_id, plant_profile_id);

CREATE INDEX IF NOT EXISTS idx_shopping_list_user_purchased
  ON shopping_list (user_id, is_purchased)
  WHERE is_purchased = false;
