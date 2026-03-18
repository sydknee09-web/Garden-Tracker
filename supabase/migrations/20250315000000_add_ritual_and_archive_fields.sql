-- Phase 2.3 P0: Ritual flow and burn archive support
-- is_pending_ritual: pebble in overflow queue (not yet in a slot)
-- is_archived: burn = archive (no hard-delete; enables Ritual History)

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS is_pending_ritual BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS nodes_pending_ritual
  ON nodes(user_id, is_pending_ritual)
  WHERE is_pending_ritual = true;

CREATE INDEX IF NOT EXISTS nodes_archived
  ON nodes(user_id, is_archived)
  WHERE is_archived = true;
