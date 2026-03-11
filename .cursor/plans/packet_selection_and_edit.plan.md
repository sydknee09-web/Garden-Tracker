# Packet Selection and Edit (Updated)

**Status:** Selection, delete cascade, Edit modal Done. Remaining: clear selection when viewMode changes; verify Select-all filtered.

## Summary

1. **Packet-level selection** — Select individual packets in Packets tab (not all packets for a profile).
2. **Tab switching** — Clear selection when switching between Grid and List views.
3. **Search/filter change** — Keep selection when search or filters change; selected items stay selected even when no longer visible.
4. **Packet delete** — Cascade to related data; show warning. **Do NOT** add to shopping list or set out_of_stock when profile has no packets left.
5. **Edit** — Single-packet edit only for now.
6. **Edit fields** — Vendor, date, qty, rating, notes, storage, **tags**, **purchase_url**. (Recommendation: also include `price` if present in schema.)
7. **Select all** — Selects filtered packets only.

---

## Part 1: Packet-Level Selection

- [PacketVaultView](src/components/PacketVaultView.tsx): `selectedPacketIds`, `onTogglePacketSelection(packetId)`, `onLongPressPacket(packetId)`; use `pkt.id`.
- [VaultPageContent](src/app/vault/VaultPageContent.tsx): Add `selectedPacketIds`, `togglePacketSelection`, `handleLongPressPacket`; when `viewMode` changes, clear both `selectedVarietyIds` and `selectedPacketIds`.
- Add `filteredPacketIds` / `onFilteredPacketIdsChange` for Select-all in Packets view.

---

## Part 2: Packet Delete — Cascade and User Choice

**Approach: User chooses in confirmation dialog** (per user preference)

### Option A: Delete packet only
- Soft-delete the packet
- Soft-delete journal entries where `seed_packet_id = packetId`
- Clear `seed_packet_id` on grow_instances that reference this packet (keep plantings, remove link)
- **Keep** grow instances

### Option B: Delete packet and all related
- Soft-delete the packet
- Soft-delete journal entries where `seed_packet_id = packetId`
- **Soft-delete** grow_instances where `seed_packet_id = packetId`
- Soft-delete tasks linked to those grow instances

**Confirmation dialog:**
> "Delete X seed packet(s)?"
> 
> [Delete packet only] — Removes the packet and journal entries. Plantings will be kept but the packet link will be cleared.
> 
> [Delete packet and all related] — Removes the packet, journal entries, and any plantings started from this packet.

**Alternative (automatic):** If we skip the user choice, we could cascade automatically: delete grows only when `seed_packet_id = packetId`; keep grows started from other packets or without a packet. Simpler UX, no dialog.

**New helper:** `cascadeOnPacketDelete.ts` — `cascadeForDeletedPackets(supabase, packetIds, userId, { deleteGrowInstances: boolean })`

---

## Part 3: Edit Packet Modal

**Editable fields:**
- vendor_name
- purchase_date
- purchase_url
- qty_status (PacketQtyOptions)
- packet_rating (StarRating)
- user_notes
- storage_location
- tags (tag picker / multi-select)

**Optional:** `price` if in schema.

**Component:** [EditPacketModal.tsx](src/components/EditPacketModal.tsx) — fetches packet, renders form, saves on submit.

---

## Part 4: Selection Actions

- **Packets view:** Delete, Edit (enabled only when exactly 1 selected).
- **Grid view:** Delete, Plant, Shopping list, Plan, Merge (unchanged).
- Clear selection when switching viewMode.
- **Do NOT clear selection when search/filters change** — Selected items remain selected even when they are no longer visible in the filtered results.

---

## Files to Create

- [src/components/EditPacketModal.tsx](src/components/EditPacketModal.tsx)
- [src/lib/cascadeOnPacketDelete.ts](src/lib/cascadeOnPacketDelete.ts)

## Files to Modify

- [src/components/PacketVaultView.tsx](src/components/PacketVaultView.tsx)
- [src/app/vault/VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx)
