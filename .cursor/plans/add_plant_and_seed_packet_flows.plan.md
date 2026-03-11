---
name: ""
overview: ""
todos: []
isProject: false
---

# Add Plant and Add Seed Packet Flow Fixes

## User Decisions (Recorded)

1. **Vault Add Packet Qty**: Use Volume (Full/Partial/Low/Empty), default Full. User can update.
2. **AddPlantModal existing + no packets**: Do NOT add profile to shopping list when creating grow with seed_packet_id: null.
3. **Link import**: Route all link imports through review-import so users can edit everything (no direct-save bypass).

---

## Part 1: Add Plant Fixes (Scan Purchase Order, Photo Import, Manual Entry)

### Schema

- **Done:** Migration [20250322000000_grow_instances_purchase_price_qty.sql](supabase/migrations/20250322000000_grow_instances_purchase_price_qty.sql) and [garden.ts](src/types/garden.ts) GrowInstance already have `purchase_price`, `purchase_quantity`, `vendor`. No new migration needed.
- ~~Add `purchase_price` and `purchase_quantity` to grow_instances (migration).~~
- ~~Add to GrowInstance type in garden.ts.~~

### addPlantMode Flow

- PurchaseOrderImport and BatchAddSeed accept `addPlantMode` prop.
- When from Add Plant: addPlantMode=true. When from Add Seed Packet: addPlantMode=false.
- review-import: when addPlantMode, create grow_instance only (no seed_packet).

### Scan Purchase Order (addPlantMode)

- Seasonal/Permanent toggle.
- Field order: Vendor, Plant name, Variety (under plant), Price, Qty, Nursery, Purchase date, Plant notes.
- Labels on all fields. Add Nursery. "Packet notes" -> "Plant notes". "Packet will be added under" -> "Plant will be added under".
- Hide Storage location.
- Photos: profile hero + journal entry for grow instance.
- Save: grow_instance with purchase_price, purchase_quantity, sown_date = purchaseDate.

### Add Plant Photo Import (addPlantMode)

- Pass addPlantMode through BatchAddSeed -> PendingPhotoImport -> vault/import/photos -> review-import.
- Same layout and save logic as Scan Purchase Order addPlantMode.

### AddPlantModal

- Add Price field. Persist purchase_price, purchase_quantity on grow_instance.
- "Existing" + seasonal + no packets: create grow with seed_packet_id: null, do NOT add to shopping list.
- "Existing" + seasonal + has packets: keep linking to selected packet.

---

## Part 2: Add Seed Packet Standardization

### Vault Add Packet Modal ([vault/[id]/page.tsx](src/app/vault/[id]/page.tsx) / [AddPlantManualModal](src/components/AddPlantManualModal.tsx))

- **Remaining:** Add missing fields to AddPlantManualModal (used from vault profile page when adding a packet).
- Add Price (optional).
- Add Volume (Full/Partial/Low/Empty), default Full. Maps to qty_status: full=100, partial=50, low=25, empty=0 (same as QuickAddSeed).
- Add Packet notes (optional).
- Add Storage location (optional).

### QuickAddSeed Manual Entry

- Add Purchase date (optional, default today). **Done** — handleLinkToExisting uses today's date.
- Add Storage location (optional).
- **Remaining — "Use existing packet" sub-flow:** When user chooses "Link to existing", offer two sub-choices: "Add new packet" (current behavior) and "Use existing packet". For "Use existing packet": fetch packets for selected profile; if exactly one in-stock packet, auto-select it and show "Selected: [Vendor] [Date]" + "Change"; if two or more, show dropdown. Ensure `fetchPackets` runs when profileId is selected; if count === 1, set selectedPacketId in state automatically.
- **Dev note — clear packet when variety changes:** The `useEffect` that watches the variety/profile ID must also set `selectedPacketId` to `null`. If you don’t clear `selectedPacketId` when the user switches varieties, they can end up "planting" or linking a packet from the previous variety (e.g. Tomato) for the new one (e.g. African Daisy). Ensure: when `profileId` changes → `setSelectedPacketId(null)` (and re-fetch packets for the new profile).

### Link Import

- Route all link imports through review-import. Remove or bypass direct-save path so users always get the full edit form.

### review-import (seed mode, NOT addPlantMode)

- Add labels to Vendor, Plant type, Variety (same style as addPlantMode layout).

---

## Files to Modify

| File                                                  | Changes                                             |
| ----------------------------------------------------- | --------------------------------------------------- |
| ~~New migration~~                                     | **Done** — see 20250322000000_grow_instances_purchase_price_qty.sql |
| ~~src/types/garden.ts~~                               | **Done** — GrowInstance has purchase_price, purchase_quantity, vendor |
| src/lib/reviewImportStorage.ts                        | addPlantMode, nursery                               |
| src/components/PurchaseOrderImport.tsx                | addPlantMode prop                                   |
| src/components/BatchAddSeed.tsx                       | addPlantMode prop                                   |
| src/components/AddPlantModal.tsx                     | Price, purchase_price/quantity, no packet when none |
| src/app/vault/review-import/page.tsx                  | addPlantMode UI + save, seed mode labels            |
| src/app/vault/import/photos/page.tsx                  | addPlantMode passthrough                            |
| src/app/vault/import/photos/hero/page.tsx             | Preserve addPlantMode                               |
| src/app/vault/import/page.tsx                         | Route to review-import (no direct-save)             |
| src/app/vault/[id]/page.tsx / AddPlantManualModal     | Add packet: Price, Volume, Notes, Storage           |
| src/components/QuickAddSeed.tsx                      | Purchase date (done), Storage, "Use existing packet" + auto-selection + clear selectedPacketId on profileId change |
| page.tsx, VaultPageContent, garden, calendar, journal | addPlantMode state for PO and BatchAddSeed          |


---

## Implementation Order

1. ~~Migration + types (purchase_price, purchase_quantity).~~ **Done** — migration and garden.ts already exist.
2. AddPlantModal: Price, no packet when none, no shopping list.
3. reviewImportStorage: addPlantMode, nursery.
4. PurchaseOrderImport + pages: addPlantMode wiring.
5. review-import: addPlantMode UI and save for purchase_order.
6. BatchAddSeed + photo flow: addPlantMode wiring.
7. review-import: addPlantMode for photo source.
8. Link import: route to review-import.
9. Vault Add Packet: Price, Volume, Notes, Storage (AddPlantManualModal).
10. QuickAddSeed: Purchase date (done), Storage location, "Use existing packet" + auto-selection + clear selectedPacketId on profileId change.
11. review-import: labels for seed mode.

