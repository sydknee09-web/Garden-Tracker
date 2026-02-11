-- Packet-level modifiers (F1, Organic, Heirloom, Open Pollinated) for variety parents.
ALTER TABLE public.seed_packets
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

COMMENT ON COLUMN public.seed_packets.tags IS 'Modifiers for this packet only, e.g. F1, Organic, Heirloom, Open Pollinated.';
