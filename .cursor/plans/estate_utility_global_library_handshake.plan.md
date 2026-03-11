---
name: "Estate Utility and Global Library Handshake"
overview: "Data Foundation (Botanical Brain) with global_plant_library; Intelligent Plant Again and Vault status logic; Luxury UI and icon consolidation; Shed bridge (I Used This -> QuickLogModal). Verification: npm run test:run 222/222; VaultPageContent.tsx remains stable before Stage 2 extraction."
todos: []
isProject: false
---

# Execute Estate Utility and Global Library Handshake

**Status:** global_plant_library table, enrich-from-name handshake (check library before AI, upsert after), and plant_profiles mature_height / mature_width migrations are Done. Any remaining "Estate Luxury" or UI consolidation items (Plant Again flow, status logic, icons, Shed bridge) remain in scope.

**Verification requirement:** Run `npm run test:run`. All **222** tests must pass. Ensure [src/app/vault/VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx) remains stable before beginning Stage 2 extraction.

---

## PM Audit (Single-Point-of-Truth)

- **Icon persistence:** Keep `ICON_MAP` keys **Spray** and **Pest**; only replace SVG paths (CloudFog / ShieldAlert). No variable renames across files.
- **Date/Care swap:** Journal header: **Date** = anchor (top-left), **Action label/icon** = accessory (top-right).
- **Supply-only logs:** DB must allow NULL `journal_entries.plant_profile_id` when `supply_profile_id` is present (already nullable in migrations).

---

## 1. Data Foundation (The Botanical Brain)

**Migration: Create `global_plant_library` table**  
New migration with fields:

- **identity_key** (Unique) — normalized plant identity for lookup
- **mature_height** (text)
- **mature_width** (text)
- **sun** (text)
- **water** (text)
- **spacing** (text)
- **germination_days** (text or integer as in schema)
- **harvest_days** (integer)
- **description** (text)

RLS: authenticated read; write via service role or API only (no `user_id`; shared brain).

**Schema: Add to `plant_profiles`**  
Migration: add **mature_height** and **mature_width** (text) to `plant_profiles`. Update [src/types/garden.ts](src/types/garden.ts) `PlantProfile`; display in "How to Grow" and Edit modal in [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx).

**Handshake**  
- **In [src/app/api/seed/enrich-from-name/route.ts](src/app/api/seed/enrich-from-name/route.ts):** Before calling AI, **check `global_plant_library`** by `identity_key`. If the key exists, **return library data** (including mature_height, mature_width, sun, water, etc.) and skip AI.
- **After any successful AI "Magic Fill":** Upsert that data back into `global_plant_library` (keyed by `identity_key`) so the shared brain grows. Apply in fill-blanks-for-profile and fill-in-blanks routes after they successfully update `plant_profiles` from AI.
- **Estate Luxury:** When applying library or AI data to a profile, only fill **empty/missing** fields; never overwrite user-tuned text (e.g. "Sandlot" limewash, "Navy/Chocolate").
- **AI prompt:** Update Magic Fill API prompts to look for "Typical mature height" and "Typical mature spread" in feet/inches so `mature_height` and `mature_width` get clean data.

---

## 2. Intelligent "Plant Again" and Status Logic

**Logic repair:** The "Plant Again" button must create a **GrowingInstance** (new planting), not a new seed packet.

**The flow** (in [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx), Planting tab):

1. On "Plant Again" click, **query** for existing **non-empty** seed packets for that variety (`plant_profile_id`, `qty_status > 0`, not archived).
2. **If one exists:** Auto-select it and open the **"New Planting"** modal (e.g. AddPlantModal with `profileId={id}` and that packet pre-populated).
3. **If multiple exist:** Show a **selection list** (e.g. packet picker or list in modal) so the user picks which packet to use for the new planting.
4. **If zero exist:** Redirect to **"Add Seed Packet"** (e.g. open Add Packet modal / `setShowAddPacketModal(true)`).

**Consolidate empty state:** Merge "No plantings yet" into a **single card** that contains the **[+ Plant Again]** button inside it (not a separate header button when empty).

**Status fix — Vault grid**  
In [src/components/SeedVaultView.tsx](src/components/SeedVaultView.tsx): Only show the **green border/dot** if **active_plantings_count > 0**. A variety with zero active grow_instances (e.g. Hulk Aster with only historical plantings) must show a **neutral grey** border. Update `getCardBorderClass(seed)` and any `effectiveStatus` so it is derived strictly from count of active plantings (status `pending` or `growing`), not from profile existence or profile-level status.

---

## 3. Luxury UI and Icon Consolidation

**Icon swap**  
In [src/lib/styleDictionary.tsx](src/lib/styleDictionary.tsx), replace **Spray** and **Pest** SVG paths with minimalist Lucide-style **CloudFog** and **ShieldAlert**. Keep `ICON_MAP` keys `Spray` and `Pest`.

**Journal layout**  
In [src/app/journal/page.tsx](src/app/journal/page.tsx), swap header order for journal entry cards/rows: **Date (top-left)**, **Action label/icon (top-right)**. Apply in mobile table cards, grid view (add top row if missing), and confirm desktop table column order.

**Profile cleanup**  
- **Care tab:** Merge the two "Care" empty-state boxes into a single **"Care Command Center"** card: one card with copy like "No care schedules yet. Generate a plan with AI or add one manually." and **Magic Fill** + **Add Manual** buttons side-by-side.
- **Plantings tab:** Move **"Plant Again"** into the **"No plantings yet"** empty-state card (prominent [+ Plant Again] CTA inside the same card).
- **Photo:** Move **"Add/Change Photo"** inside the **Edit Profile** modal; remove the standalone Add Photo and Change photo buttons from the profile hero area.

---

## 4. The Shed Bridge

**"I Used This" fix**  
In [src/app/vault/shed/[id]/page.tsx](src/app/vault/shed/[id]/page.tsx): Update the "I used this today" button to **open QuickLogModal** with the supply **pre-selected** and **actionType defaulted** (e.g. Fertilizer -> Fertilize, Pesticide -> Spray). Do not insert a journal entry and show a toast; let the user complete the log in the modal.

**QuickLogModal** [src/components/QuickLogModal.tsx](src/components/QuickLogModal.tsx): Add props `preSelectedSupplyId`, `defaultActionType`. When opened from Shed, pre-fill supply and action; on submit include `supply_profile_id` and allow `plant_profile_id: null` for supply-only logs.

**Verification requirement**  
Run **npm run test:run**. All **222** tests must pass. Ensure **VaultPageContent.tsx** remains stable before beginning Stage 2 extraction.

---

## File summary

| Area | Files |
|------|--------|
| Data Foundation | New migration `global_plant_library`; [src/types/garden.ts](src/types/garden.ts); [src/app/api/seed/enrich-from-name/route.ts](src/app/api/seed/enrich-from-name/route.ts); fill-blanks-for-profile; fill-in-blanks |
| Plant Again + Status | [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx), [src/components/SeedVaultView.tsx](src/components/SeedVaultView.tsx) |
| Luxury UI + Icons | [src/lib/styleDictionary.tsx](src/lib/styleDictionary.tsx), [src/app/journal/page.tsx](src/app/journal/page.tsx), [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx), [src/components/CareScheduleManager.tsx](src/components/CareScheduleManager.tsx) |
| Shed Bridge | [src/app/vault/shed/[id]/page.tsx](src/app/vault/shed/[id]/page.tsx), [src/components/QuickLogModal.tsx](src/components/QuickLogModal.tsx) |
