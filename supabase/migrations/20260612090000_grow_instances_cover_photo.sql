-- Cover photo for plant instances (Syd design lock 2026-06-11).
-- 3-mode state machine per grow_instance:
--   auto                — cover = most-recent non-receipt journal photo (default; silent profile-hero fallback)
--   pinned_journal      — user pinned a specific journal photo (cover_photo_journal_entry_id set)
--   pinned_profile_hero — user pinned the species profile hero (journaling never overrides)
-- Receipt skip in auto mode = entry_type 'vault_add' (the acquisition/receipt artifact type);
-- journal_entries needs no schema change.
-- Additive + idempotent. Run BEFORE deploying code that selects these columns
-- (GardenView names them in a .select()).
ALTER TABLE grow_instances ADD COLUMN IF NOT EXISTS cover_photo_mode text NOT NULL DEFAULT 'auto'
  CHECK (cover_photo_mode IN ('auto', 'pinned_journal', 'pinned_profile_hero'));
ALTER TABLE grow_instances ADD COLUMN IF NOT EXISTS cover_photo_journal_entry_id uuid
  REFERENCES journal_entries(id) ON DELETE SET NULL;
