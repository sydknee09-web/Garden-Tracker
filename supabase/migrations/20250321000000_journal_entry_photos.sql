-- Section 7: Multi-photo support for journal entries
-- One row per photo, linked to journal entry, with sort order.

CREATE TABLE IF NOT EXISTS journal_entry_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  image_file_path text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_photos_journal ON journal_entry_photos (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_photos_user ON journal_entry_photos (user_id);

ALTER TABLE journal_entry_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entry_photos_manage_with_grant" ON journal_entry_photos
  FOR ALL
  USING (user_id = auth.uid() OR public.has_edit_grant_from(user_id))
  WITH CHECK (user_id = auth.uid() OR public.has_edit_grant_from(user_id));

CREATE POLICY "household_journal_entry_photos_select" ON journal_entry_photos
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));

-- Backfill: copy existing image_file_path into journal_entry_photos as first photo
INSERT INTO journal_entry_photos (journal_entry_id, image_file_path, sort_order, user_id)
SELECT id, image_file_path, 0, user_id
FROM journal_entries
WHERE image_file_path IS NOT NULL
  AND deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM journal_entry_photos jep
    WHERE jep.journal_entry_id = journal_entries.id
  );

COMMENT ON TABLE journal_entry_photos IS 'One row per photo per journal entry. Display reads from here; image_file_path on journal_entries is fallback for legacy.';
