-- Add sow method and seed/plant counts to grow_instances
-- Used for: direct_sow vs seed_start, seeds sown, germination logging, plant count

ALTER TABLE grow_instances
  ADD COLUMN IF NOT EXISTS sow_method text
    CHECK (sow_method IS NULL OR sow_method IN ('direct_sow', 'seed_start')),
  ADD COLUMN IF NOT EXISTS seeds_sown integer
    CHECK (seeds_sown IS NULL OR seeds_sown >= 0),
  ADD COLUMN IF NOT EXISTS seeds_sprouted integer
    CHECK (seeds_sprouted IS NULL OR seeds_sprouted >= 0),
  ADD COLUMN IF NOT EXISTS plant_count integer
    CHECK (plant_count IS NULL OR plant_count >= 0);

COMMENT ON COLUMN grow_instances.sow_method IS 'direct_sow = final location; seed_start = will transplant';
COMMENT ON COLUMN grow_instances.seeds_sown IS 'Optional count of seeds planted at sow date';
COMMENT ON COLUMN grow_instances.seeds_sprouted IS 'Optional count that sprouted; set via Log germination';
COMMENT ON COLUMN grow_instances.plant_count IS 'Current living plants; updated when thinning/transplanting/losses';
