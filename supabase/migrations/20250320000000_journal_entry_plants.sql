-- Section 6: One journal entry, multiple plants (no duplicates)
-- New linking table: journal_entry_plants
-- One master journal entry can be tagged to multiple plants via this table.

CREATE TABLE IF NOT EXISTS journal_entry_plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  plant_profile_id uuid NOT NULL REFERENCES plant_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(journal_entry_id, plant_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_plants_journal ON journal_entry_plants (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_plants_plant ON journal_entry_plants (plant_profile_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_plants_user ON journal_entry_plants (user_id);

ALTER TABLE journal_entry_plants ENABLE ROW LEVEL SECURITY;

-- RLS: same pattern as journal_entries (manage with grant)
CREATE POLICY "journal_entry_plants_manage_with_grant" ON journal_entry_plants
  FOR ALL
  USING (user_id = auth.uid() OR public.has_edit_grant_from(user_id))
  WITH CHECK (user_id = auth.uid() OR public.has_edit_grant_from(user_id));

-- Household can read each other's journal_entry_plants (for family view)
CREATE POLICY "household_journal_entry_plants_select" ON journal_entry_plants
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));

-- Backfill: existing single-plant entries get one journal_entry_plants row
INSERT INTO journal_entry_plants (journal_entry_id, plant_profile_id, user_id)
SELECT id, plant_profile_id, user_id
FROM journal_entries
WHERE plant_profile_id IS NOT NULL
  AND deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM journal_entry_plants jep
    WHERE jep.journal_entry_id = journal_entries.id
  );

COMMENT ON TABLE journal_entry_plants IS 'Links journal entries to plant profiles. One entry can tag multiple plants. Canonical source for "which plants is this entry tagged to".';
