-- Phase 1 Master Ledger: intent_statement, layout_type, pebble_logic
-- See MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md

ALTER TABLE mountains ADD COLUMN IF NOT EXISTS intent_statement TEXT;
ALTER TABLE mountains ADD COLUMN IF NOT EXISTS layout_type TEXT DEFAULT 'climb' CHECK (layout_type IN ('climb', 'survey'));
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS pebble_logic TEXT DEFAULT 'freeform' CHECK (pebble_logic IN ('sequential', 'freeform'));
