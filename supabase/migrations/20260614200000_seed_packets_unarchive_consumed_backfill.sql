-- Sprint 13 — un-tombstone consumed packets (one-shot data backfill)
--
-- Context: the old `consumePackets` (Vault "Plant" flow) wrongly soft-deleted packets when
-- they hit qty 0 — it conflated Law 2 (soft-delete = true user DELETION) with Law 3 (used-up
-- packets are ARCHIVED, not deleted). The forward-fix (commit bfb5a17) stops new soft-deletes;
-- this migration corrects the EXISTING rows so consumed packets are restored to their proper
-- Law-3 archived state and become visible again in the profile "Used up (N)" subsection.
--
-- Scope predicate: `deleted_at IS NOT NULL AND is_archived = true AND qty_status = 0`
--   = consumption-shaped tombstones (the only path that sets all three together is consumePackets).
--   Genuine user deletions (deletePacket / cascade) leave qty_status / is_archived as-was, so
--   deletion-shaped rows (qty > 0 OR not archived) are NOT matched and stay tombstoned.
--
-- Caveat (accepted, Syd greenlight 2026-06-14): a used-up packet the user later MANUALLY deleted
-- is indistinguishable from a consumed one by columns alone (Q-A2: 19 consumption-shaped, only 3
-- with a live planting link). Broad recovery was chosen over tight (the reported Parsley bug is in
-- the 16 with no live planting). Recovery is reversible — any unwanted row can be deleted again
-- (which now correctly soft-deletes it). Restoring to archived-and-visible is the Law-3 state.
--
-- IDEMPOTENT: re-running matches nothing (the rows already have deleted_at IS NULL).
-- All-users: the architectural bug affected every account that used the Vault Plant flow; the
-- forward-fix already shipped globally, so the data correction is global too.

UPDATE public.seed_packets
SET deleted_at = NULL
WHERE deleted_at IS NOT NULL
  AND is_archived = true
  AND COALESCE(qty_status, 0) = 0;
