-- ============================================================================
-- seed_packets: add packet_rating (1-5 personal rating per packet)
-- ============================================================================

ALTER TABLE seed_packets
  ADD COLUMN IF NOT EXISTS packet_rating smallint
  CHECK (packet_rating BETWEEN 1 AND 5);

COMMENT ON COLUMN seed_packets.packet_rating IS
  'User''s personal 1–5 rating for this packet. NULL = not yet rated.';
