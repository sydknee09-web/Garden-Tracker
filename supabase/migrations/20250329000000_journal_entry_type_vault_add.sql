-- Add vault_add to journal_entries.entry_type (Inventory Acquisition: purchased/received, not yet planted).
-- Run this migration BEFORE deploying code that inserts vault_add to avoid constraint violations.
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_entry_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_entry_type_check
  CHECK (entry_type IN ('planting','growth','harvest','note','care','pest','death','quick','vault_add'));
