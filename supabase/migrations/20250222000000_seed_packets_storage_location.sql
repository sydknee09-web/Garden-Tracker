-- Optional storage location per packet (e.g. "Green box", "Shed shelf 2") so users can find packets.
ALTER TABLE public.seed_packets
  ADD COLUMN IF NOT EXISTS storage_location text;

COMMENT ON COLUMN public.seed_packets.storage_location IS 'Where the user stores this physical packet, e.g. box name or drawer.';
