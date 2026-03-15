-- Multi-supply per journal entry: junction table for linking journal entries to multiple supplies.
-- Mirrors journal_entry_plants pattern. Backfill copies existing supply_profile_id links.

CREATE TABLE IF NOT EXISTS journal_entry_supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  supply_profile_id uuid NOT NULL REFERENCES supply_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(journal_entry_id, supply_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_supplies_journal ON journal_entry_supplies (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_supplies_supply ON journal_entry_supplies (supply_profile_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_supplies_user ON journal_entry_supplies (user_id);

ALTER TABLE journal_entry_supplies ENABLE ROW LEVEL SECURITY;

-- RLS: mirror journal_entry_plants (Law 1 — user_id required on every INSERT)
CREATE POLICY "journal_entry_supplies_manage_with_grant" ON journal_entry_supplies
  FOR ALL
  USING (user_id = auth.uid() OR public.has_edit_grant_from(user_id))
  WITH CHECK (user_id = auth.uid() OR public.has_edit_grant_from(user_id));

CREATE POLICY "household_journal_entry_supplies_select" ON journal_entry_supplies
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));

-- Backfill: copy existing supply links so old entries show supplies correctly
INSERT INTO journal_entry_supplies (journal_entry_id, supply_profile_id, user_id)
SELECT id, supply_profile_id, user_id
FROM journal_entries
WHERE supply_profile_id IS NOT NULL
  AND deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM journal_entry_supplies jes
    WHERE jes.journal_entry_id = journal_entries.id
  );

-- Trigger: ensure user_id in journal_entry_supplies matches parent journal_entry (prevents zombie links in shared households)
CREATE OR REPLACE FUNCTION check_journal_entry_supplies_user_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id != (SELECT user_id FROM journal_entries WHERE id = NEW.journal_entry_id) THEN
    RAISE EXCEPTION 'journal_entry_supplies.user_id must match journal_entries.user_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entry_supplies_user_match
  BEFORE INSERT OR UPDATE ON journal_entry_supplies
  FOR EACH ROW EXECUTE FUNCTION check_journal_entry_supplies_user_match();

COMMENT ON TABLE journal_entry_supplies IS 'Links journal entries to supply profiles. One entry can tag multiple supplies. Canonical source for "which supplies were used".';
