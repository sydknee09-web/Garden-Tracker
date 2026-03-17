-- Add prune to journal_entries.entry_type (Pruning care activity, distinct from planting).
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_entry_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_entry_type_check
  CHECK (entry_type IN ('planting','growth','harvest','note','care','pest','death','quick','vault_add','prune'));
