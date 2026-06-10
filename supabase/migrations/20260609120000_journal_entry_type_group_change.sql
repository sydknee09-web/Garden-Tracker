-- Add group_change to journal_entries.entry_type.
-- Auto-logged when a plant is added to / moved between / removed from a Group
-- (Groups follow-up ship 2026-06-09). Informational, rendered compact (info-note style).
-- Additive + idempotent: drops then re-adds the CHECK with a superset of allowed values.
-- Run BEFORE deploying code that inserts group_change to avoid constraint violations.
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_entry_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_entry_type_check
  CHECK (entry_type IN (
    'planting','growth','harvest','note','care','pest','death','quick','vault_add','prune','cold_stratify','group_change'
  ));
