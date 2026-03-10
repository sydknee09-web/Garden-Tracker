-- Add optional vendor/source (store or nursery) to grow_instances for tracking where each planting came from.
ALTER TABLE grow_instances
  ADD COLUMN IF NOT EXISTS vendor text;

COMMENT ON COLUMN grow_instances.vendor IS 'Store or nursery where this planting was purchased (e.g. Home Depot, Briggs Tree Nursery).';
