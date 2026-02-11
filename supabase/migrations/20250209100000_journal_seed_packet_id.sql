-- Link journal entry to specific seed packet used (e.g. when logging a Plant action).
-- When set, the app can decrement that packet's inventory.
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS seed_packet_id uuid REFERENCES public.seed_packets(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.journal_entries.seed_packet_id IS 'When logging a Plant action: which packet was used so that packet inventory (qty_status) can be decremented.';
