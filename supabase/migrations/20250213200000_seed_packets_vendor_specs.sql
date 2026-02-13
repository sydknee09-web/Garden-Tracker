-- Option B: each packet stores that vendor's growing recommendations (sowing depth, spacing, sun, etc.)
-- so the profile page can show "By packet" / "Vendor recommendations" alongside the single profile set.
ALTER TABLE seed_packets
  ADD COLUMN IF NOT EXISTS vendor_specs jsonb;

COMMENT ON COLUMN seed_packets.vendor_specs IS 'Vendor-specific growing specs from import: sowing_depth, spacing, sun_requirement, days_to_germination, days_to_maturity, plant_description';
