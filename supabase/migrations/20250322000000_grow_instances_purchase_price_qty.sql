-- Add purchase_price and purchase_quantity to grow_instances for tracking plants bought (nursery, store).
-- Separate from seed_packets.price which tracks packet purchase cost.
ALTER TABLE grow_instances
  ADD COLUMN IF NOT EXISTS purchase_price text,
  ADD COLUMN IF NOT EXISTS purchase_quantity integer;

COMMENT ON COLUMN grow_instances.purchase_price IS 'What you paid for the plant (e.g. $12.99). Separate from seed packet price.';
COMMENT ON COLUMN grow_instances.purchase_quantity IS 'Number of plants purchased. May equal initial plant_count.';
