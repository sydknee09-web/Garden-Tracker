-- Logic & Leaf: order_index for sibling ordering
-- Enables "first incomplete boulder" (Climb) and "first incomplete leaf" (sequential).
-- When fetching siblings: ORDER BY order_index ASC, created_at ASC.

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS nodes_order_index ON nodes(user_id, path, order_index);

COMMENT ON COLUMN nodes.order_index IS 'Display order among siblings. Used by get_packable_candidates for Climb/sequential gates.';
