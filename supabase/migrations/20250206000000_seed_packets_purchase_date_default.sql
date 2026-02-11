-- Ensure seed_packets.purchase_date exists and defaults to current date on insert.
ALTER TABLE seed_packets
  ADD COLUMN IF NOT EXISTS purchase_date date;

ALTER TABLE seed_packets
  ALTER COLUMN purchase_date SET DEFAULT CURRENT_DATE;
