# Remaining Steps — Consolidated Roadmap

**Purpose:** Single ordered plan for remaining UX/polish work. Execute in order; run tests after each phase.

---

## Locked decisions (Architectural Luxury)

| Topic | Decision |
|-------|----------|
| **Stroke** | 1.2 everywhere (precise, high-end). Phase 1 and Phase 8 both use 1.2. |
| **Primary green** | #064e3b (Deep Forest Green) as baseline for borders, icons, primary actions. |
| **Emerald-luxury (#50C878)** | Reserved for **success states only**: toasts, "Completed" checkmarks, "In Stock" badges. Reward, not default UI. |
| **/journal/new** | Deprecate. Quick Log modal is the sanctuary standard. In Phase 5/6: redirect /journal/new → Journal tab and open Quick Log modal. |
| **Phase 0 redirect** | **Only** intentional redirect: when user creates a **new plant profile** (new variety) → redirect to `/vault/[id]`. Every other add (packet to existing variety, sow, task, supply, journal, grow instance on existing profile) = **Stay + Refresh**. |
| **Tests** | Fix as we go after each phase. |

---

**Already done (no action):**
- Planting & Journal UX fixes (journal note format, sort, add-new packet, layout, back arrow, icons, hero load).
- Packet selection: clear on viewMode change; Select-all uses filtered packets.
- Quick Log modal from FAB (Add journal → Quick Log slide-over); NAVIGATION_MAP is source of truth.
- Loading states: LoadingState component, migrations, U+2026, inline save loading.

---

## Phase 0: Universal Add Menu audit (quick)

**Goal:** Confirm “stay on page + refresh” after every FAB add. Fix any path that doesn’t refresh.

**Steps:**
1. For each FAB add path, verify:
   - **Add Seed Packet** → QuickAddSeed `onSuccess` → parent refetches/refreshes list and stays on page.
   - **Add plant** (Manual / Start Seeds) → after AddPlantModal or after planting flow, parent refreshes and stays on page.
   - **Add to shed** → QuickAddSupply `onSuccess` → parent refreshes Shed/list and stays on page.
   - **Add task** → New Task submit → calendar/task list refetches; stay on Calendar.
   - **Add journal** → Quick Log submit → `onJournalAdded?.()` or equivalent triggers refresh (e.g. `router.refresh()` on profile).
2. **Files to check:** Each page that hosts the FAB: `VaultPageContent.tsx`, `garden/page.tsx`, `journal/page.tsx`, `calendar/page.tsx`, `page.tsx` (home). Ensure each passes a success callback that refreshes the relevant data (refetchTrigger, router.refresh(), or equivalent).
3. **No new files.** Fix only missing refresh or navigation.

**Exit:** All five add paths leave the user on the same page with updated data. Run `npm run test:run`.

---

## Phase 1: Full Luxury Polish — Iconography

**Source:** [full_luxury_polish.plan.md](full_luxury_polish.plan.md) § 1.

**File:** [src/lib/styleDictionary.tsx](src/lib/styleDictionary.tsx)

**Steps:**
1. **Global stroke:** In `iconProps()`, set `strokeWidth: 1.2` (Architectural Luxury standard).
2. **Primary icon color:** Use #064e3b (Deep Forest Green) for default icon color where applicable.
3. **PlantIcon:** Replace current shape with a single elegant leaf stroke (Lucide-style).
4. **SeedIcon:** Replace with sharp rectangle + small “+” inside (stroke-only).
4. **JournalIcon:** Replace with minimal “lined paper”: document outline + 2–3 horizontal lines, no spine/bookmark.
5. **HarvestIcon:** Ensure minimalist basket/fruit stroke, no fill.
6. **PestIcon:** Add new icon — minimalist bug or AlertTriangle stroke. Export as `ICON_MAP.Pest`.
7. Ensure no `fill` on these; all stroke-only. Reserve emerald-luxury (#50C878) for success-state usage elsewhere, not in the dictionary default.

**Exit:** `npm run build` and `npm run test:run`. Fix any broken imports or snapshots.

---

## Phase 2: Full Luxury Polish — Add permanent plant modal

**Source:** [full_luxury_polish.plan.md](full_luxury_polish.plan.md) § 3.

**File:** [src/components/AddPlantModal.tsx](src/components/AddPlantModal.tsx)

**Steps:**
1. **Vendor above Date:** In “Link to existing” when `plantType === "permanent"`, add “Vendor / Nursery” text input **above** “Date planted”. Reuse `vendorNursery` state and existing `vendor` on grow_instances insert.
2. **Button labels:**
   - Permanent: **“Confirm Planting”**
   - Seasonal: **“Confirm Sowing”**
   - Keep “Adding…” during submit.
3. **Spacing:** Reduce vertical padding ~15% (e.g. `space-y-4` → `space-y-3`, `p-4` → `p-3.5`); keep `min-h-[44px]` touch targets.

**Exit:** `npm run test:run` (e.g. AddPlantModal tests).

---

## Phase 3: Full Luxury Polish — Profile polish (vault [id])

**Source:** [full_luxury_polish.plan.md](full_luxury_polish.plan.md) § 4.

**File:** [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx)

**Steps:**
1. **Book emoji → icon:** Replace 📖 with `<ICON_MAP.Journal className="w-4 h-4" />`; keep button `min-w-[44px] min-h-[44px]` and aria-label.
2. **Journal event labels:** Use **emerald-luxury (#50C878) only for success/reward contexts** per Locked decisions. For generic journal types (growth, planting, note, quick) use either emerald-luxury for a "logged/completed" feel or #064e3b for neutral; align with "success state" rule. Keep harvest/care/pest/death semantic colors unchanged.
3. **Button consistency:** Action buttons use same icon size (e.g. `w-4 h-4`); stroke 1.2 from Phase 1.

**Exit:** `npm run test:run`.

---

## Phase 4: Full Luxury Polish — Plants card + Journal tab + Journal icon behavior

**Source:** [full_luxury_polish.plan.md](full_luxury_polish.plan.md) § 5.

**File:** [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx)

**Steps:**
1. **Clean Plants card:** Remove nested journal block from each planting card. Keep: Status, Date, Location, Vendor. Remove from card body: seeds_sown, seeds_sprouted, plant_count, end_reason, “Harvested N times” (or keep single-line harvest count if desired). Ensure `growInstances` fetch includes `vendor`.
2. **Journal tab:** Confirm feed is filtered by `plant_profile_id` only (already so). Add **vertical timeline line**: left margin/bar, small node (dot) per entry in emerald-luxury; content offset to the right (`pl-6`/`pl-8`, line at `left-3`).
3. **Journal icon on planting card:** Change so tapping Journal icon (a) switches to Journal tab (`setActiveTab("journal")`), (b) scrolls to journal timeline (ref + `scrollIntoView({ behavior: "smooth" })`). **Option A:** Journal icon only goes to Journal tab (no BatchLogSheet). Add-journal stays via FAB Quick-Log with pre-selected plant when on profile. Remove/repurpose current `setBatchLogTarget`/`setBatchLogOpen` for that button.

**Exit:** `npm run test:run`.

---

## Phase 5: Full Luxury Polish — Unified Action Center layout

**Source:** [full_luxury_polish.plan.md](full_luxury_polish.plan.md) § 7.

**Scope:** Same layout for (1) Quick-Log (in Universal Add or on profile), (2) BatchLogSheet, (3) `/journal/new` page. **Deprecate /journal/new:** In Phase 5/6, redirect `/journal/new` → Journal tab and open Quick Log modal automatically.

**Steps:**
1. **Unified layout (all three):**
   - **Top:** Quick Actions row (horizontal scroll): Water, Fertilize, Spray, Growth, Note, Planting, **Harvest** (ICON_MAP.Harvest), **Pest/Issue** (ICON_MAP.Pest). Rounded-xl, primary #064e3b theme (per Locked decisions); stroke 1.2 icons; no emojis.
   - **Middle:** Quick Memo textarea (Markdown-friendly).
   - **Bottom:** Photo Import (ICON_MAP.Camera, gallery/upload icon); rounded-xl, #064e3b. Replace any emojis (📷, 🖼, etc.) with ICON_MAP.
2. **Smart pre-fill:** When opened from a plant profile (Quick-Log with `preSelectedProfileId` or BatchLogSheet for one batch): pre-select plant, hide search bar, show linked plant(s) as chips. When from global FAB: show Search/Select Plants.
3. **Optional:** Extract shared `ActionCenterLayout` or `JournalEntryForm` (Top / Middle / Bottom) used by Quick-Log, BatchLogSheet, journal/new to avoid drift.
4. **Quick-Log refresh:** Ensure `onJournalAdded` is passed from VaultPageContent (and any profile host) and calls `router.refresh()` after successful insert so Journal tab updates immediately.

**Files:** [src/components/QuickLogModal.tsx](src/components/QuickLogModal.tsx), [src/components/BatchLogSheet.tsx](src/components/BatchLogSheet.tsx), [src/app/journal/new/page.tsx](src/app/journal/new/page.tsx), [src/components/UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx), [src/app/vault/VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx).

**Exit:** `npm run test:run` and `npm run build`.

---

## Phase 6: Quick-Log inside Universal Add (if not already)

**Source:** [full_luxury_polish.plan.md](full_luxury_polish.plan.md) § 2.

**Check first:** NAVIGATION_MAP says “Add journal” opens Quick Log modal. If UniversalAddMenu already opens QuickLogModal (not navigate to `/journal/new`), this phase is **done**. Otherwise:

**Steps:**
1. In UniversalAddMenu, “Add journal” opens Quick-Log modal/slide-over (no navigate to `/journal/new`).
2. Optional prop `preSelectedProfileId`: when on `/vault/[id]`, parent passes profile id so Quick-Log pre-selects that plant.
3. VaultPageContent: derive `preSelectedProfileId` from pathname when route is `/vault/[id]`; pass into UniversalAddMenu.
4. On success: call `onJournalAdded?.()` so parent can `router.refresh()`.

**Exit:** `npm run test:run`.

---

## Phase 7: Loading screen & cache (optional)

**Source:** [loading_screen_ux_fixes.plan.md](loading_screen_ux_fixes.plan.md).

**Status:** Part 1 & 3 done (initial load only, Skip removed; PageSkeleton on in-app nav). Part 2 and 4 optional.

**Steps (if desired):**
1. **Part 2:** LoadingScreen: remove any remaining Skip; background light teal/emerald; fade-in on mount; no fade-out.
2. **Part 4:** Add `cacheControl: "31536000"` to uploads in BatchAddSeed.tsx, batch-import route, supply extract-from-url route, review-import page (all listed in plan). Optionally bump SW `CACHE_NAME` to force refresh.

**Exit:** `npm run test:run`.

---

## Phase 8: Global UI/UX audit (larger)

**Source:** [global_ui_ux_audit_refactor.plan.md](global_ui_ux_audit_refactor.plan.md).

**Order:** Execute in plan order; run tests after Step 1 and Step 2.

1. **Step 1 — Feedback & toasts:** Global Toast component/provider (emerald-900 success, neutral-800 removal). Creation paths → success toast + hapticSuccess(); completion paths → strike-through + hapticClick(50), no toasts; destruction → confirmation sheet + “Item Removed” neutral toast.
2. **Step 2 — Navigation & loading:** Remove Skip from vault/import/manual (hero step only). Top-left Back + centered titles on FAB sub-menus (QuickAdd, NewTask). Vault Select flicker fix: bg-emerald-50 + transition-colors.
3. **Step 3 — Forms & data:** Migration: vendor + price on supply_profiles; Shed 2-column Vendor/Price grid. Labels: remove “(optional)”; red * only for Plant Name, Seed Variety, Product Name, Task Title, Journal Note.
4. **Step 4 — Visual & tactile:** Primary green #064e3b; button order (Primary right/top, Cancel left/bottom); active:scale-95; styleDictionary + Lucide strokeWidth 1.2, color #064e3b.
5. **Step 5 — Testing:** Full suite after Step 1 and Step 2; fix regressions.

**Note:** Overlaps with Full Luxury Polish on icons/colors; reconcile stroke 1.2 vs 1.5 and #064e3b vs emerald-luxury in one place to avoid double edits.

---

## Phase 9: Calendar & Shed refactor (larger)

**Source:** [calendar_shed_fab_refactor.plan.md](calendar_shed_fab_refactor.plan.md).

**Highlights:**
- Shed: supply_profiles size/size_uom migration; review-import Save label; user-guided image crop; skeleton loader with branded shimmer.
- Calendar: local-date helper (no UTC-off-by-one); dot logic (grey only for completed/past); recurrence 30-day batch creation; reschedule “Just this instance” vs “Push schedule”; Delete Future vs Delete All (soft-delete, double confirm for Delete All).
- QuickLogModal already aligned to Action Center per plan; validate after Phase 5.

**Execute in plan order;** run tests after each major section.

---

## Summary table

| Phase | Scope                    | Key files / actions                                      |
|-------|--------------------------|----------------------------------------------------------|
| 0     | Universal Add audit      | All FAB hosts: ensure onSuccess/refresh on each add path |
| 1     | Iconography              | styleDictionary.tsx: stroke 1.2, #064e3b, Plant/Seed/Journal/Pest |
| 2     | AddPlantModal            | Vendor above Date; Confirm Planting/Sowing; spacing      |
| 3     | Profile polish           | vault/[id]: Journal icon, emerald-luxury tags, buttons   |
| 4     | Plants card + Journal tab| Clean cards; timeline; Journal icon → tab + scroll       |
| 5     | Action Center layout     | QuickLog, BatchLogSheet, journal/new unified layout      |
| 6     | Quick-Log in FAB         | Verify only (likely done); add preSelectedProfileId if missing |
| 7     | Loading + cache (opt.)   | LoadingScreen teal/fade-in; cacheControl on uploads      |
| 8     | Global UI audit          | Toasts, haptics, Skip, labels, colors, icons             |
| 9     | Calendar & Shed refactor | Schema, local date, recurrence, delete semantics, Shed UI |

**Validation:** After every phase run `npm run test:run`. Before marking “polish complete” run `npm run build` and fix any failures.
