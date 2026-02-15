-- Ensure seed_packets.storage_location exists (fixes "column does not exist" on plant profile page).
-- Idempotent: safe to run even if 20250222000000 was already applied.
ALTER TABLE public.seed_packets
  ADD COLUMN IF NOT EXISTS storage_location text;

COMMENT ON COLUMN public.seed_packets.storage_location IS 'Where the user stores this physical packet, e.g. box name or drawer.';
