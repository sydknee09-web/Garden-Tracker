---
name: ""
overview: ""
todos: []
isProject: false
---

# Full Luxury Polish — Vault & Journaling

## Summary

Execute a "Full Luxury Polish" across the Vault and Journaling systems: standardize iconography to 1.5px stroke and Lucide-style shapes, replace "Add Journal" navigation with a Quick-Log modal/slide-over (with optional plant pre-selection from profile), **unify Global Journal and Plant-Specific Log into a single "Action Center" layout** (Quick Actions row, Quick Memo, Photo Import), add Vendor field and copy/spacing updates to the Add permanent plant modal, polish the profile page (book icon, emerald journal tags, button consistency), refine the Plants–Journal relationship on the profile (clean cards, contextual journal, smart navigation, timeline), then validate with build and test suite.

---

## 1. Iconography & style dictionary

**File:** [src/lib/styleDictionary.tsx](src/lib/styleDictionary.tsx)

- **Stroke weight:** In `iconProps()`, change `strokeWidth: 2.5` to `strokeWidth: 1.5` so all SVG icons use the same sharp, minimalist weight.
- **AddIcon:** Keep circle + plus; stroke-only is already fine. No fill.
- **PlantIcon:** Replace current "filled pot" shape with a **single elegant leaf stroke** (e.g. one curved leaf path, Lucide-style).
- **SeedIcon:** Replace seed-pod with a **sharp rectangle and a small "+" inside** (e.g. `<rect>` with stroke, plus a short cross in the center).
- **JournalIcon:** Replace notebook shape with a **minimal "lined paper"** icon: simple document outline + 2–3 horizontal lines (no spine or bookmark). Keep stroke-only, 1.5 weight.
- **Harvest:** Already present as `HarvestIcon`; ensure it is a minimalist basket/fruit stroke (no fill). Use in Action Center Quick Actions.
- **Pest/Issue:** Add **PestIcon** — minimalist bug or alert-triangle stroke (e.g. Lucide-style bug or `AlertTriangle`). Export as `ICON_MAP.Pest` for the Quick Action "Pest/Issue".
- No other icon changes required beyond the global stroke width; ensure no `fill` on these so they stay sharp/architectural.

---

## 2. Quick-Log journal flow (modal/slide-over)

**Files:** [src/components/UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx), [src/app/vault/VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx).

- In `UniversalAddMenu`, change "Add journal" from calling `onAddJournal()` (navigate to `/journal/new`) to opening a **modal/slide-over** (new screen `"add-journal"`).
- Add optional prop `preSelectedProfileId?: string`; when on `/vault/[id]`, parent passes current profile id so Quick-Log **pre-selects that plant**.
- **VaultPageContent:** Derive `preSelectedProfileId` from `pathname` when it matches `/vault/[id]` (exclude `/vault`, `/vault/plant`, `/vault/import`, etc.) and pass into `UniversalAddMenu`.
- **Form fields:** Date (default today), Event type (Growth, Planting, Harvest, Note), Plant selector (pre-selected or dropdown), Markdown-friendly textarea.
- **Submit:** Insert into `journal_entries` with `user_id`, `plant_profile_id`, `grow_instance_id: null`, `entry_type`, `note`, `created_at` from form date. On success close and call `**onJournalAdded?.()`** so the UI refreshes immediately.
- **Quick-Log refresh (crucial):** There is nothing less "Luxury" than performing an action and seeing nothing happen. When the user logs "Pruned" or "Fertilized," it must appear in the Journal tab immediately. **VaultPageContent** (and any parent that hosts the menu on a profile page) must pass a callback that triggers `**router.refresh()`** when Quick-Log submits successfully (e.g. `onJournalAdded={() => router.refresh()}` when `pathname` is `/vault/[id]`). Implement `onJournalAdded` as an optional prop on `UniversalAddMenu` and invoke it after successful insert.
- **UX:** Second screen inside same dialog; back button returns to main Add menu. Reuse `max-h-[85vh]` and internal scroll.
- **Layout:** Quick-Log should use the **unified Action Center layout** (Section 7): Quick Actions row (top), Quick Memo (middle), Photo Import (bottom). Event type can be chosen via Quick Actions (Growth, Planting, Harvest, Note, Pest/Issue) instead of a separate dropdown.

---

## 3. Vault & Add permanent plant modal

**File:** [src/components/AddPlantModal.tsx](src/components/AddPlantModal.tsx)

- **Vendor / Nursery above Date planted:** In "Link to existing" flow when `plantType === "permanent"`, add "Vendor / Nursery" text input **above** "Date planted". Reuse `vendorNursery` state and existing `vendor` on grow_instances insert.
- **Copy (hybrid approach):** Primary submit button label depends on plant type:
  - **Permanent (trees/perennials):** **"Confirm Planting"** — weighty, like committing a tree to the soil for decades.
  - **Seasonal/Annuals:** **"Add Plant"** or **"Confirm Sowing"** — keeps the UX light for ephemeral plantings. Use **"Confirm Sowing"** for seasonal to mirror the gravity of the action without feeling heavy.
- Keep "Adding…" during submit for both.
- **Spacing:** Reduce vertical padding by ~15%: e.g. `space-y-4` → `space-y-3`, `p-4` → `p-3.5`; keep touch targets (`min-h-[44px]`).

---

## 4. Profile polish (vault [id] page)

**File:** [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx)

- **Emoji to icon:** Replace book emoji (📖) at ~line 2366 with `<ICON_MAP.Journal className="w-4 h-4" />`; keep button `min-w-[44px] min-h-[44px]` and aria-label.
- **Journal event labels:** Use the app's **emerald-luxury** brand color (#50C878) for generic types. Prefer Tailwind token `emerald-luxury` (already in config at `#50C878`). If the token isn't available in a given context, use arbitrary values `**text-[#50C878]`** and `**bg-[#50C878]/10**` so the branding stays "expensive" — do not fall back to generic `emerald-*`. Apply to `growth`, `planting`, `note`, `quick`. Keep harvest/care/pest/death semantic colors at ~lines 2312, 2398.
- **Button consistency:** After global `strokeWidth: 1.5` in styleDictionary, ensure action buttons use same icon size (e.g. `w-4 h-4`).

---

## 5. Plants–Journal relationship (profile page)

**File:** [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx)

Refine the relationship between the **Plants** tab and the **Journal** tab so cards stay clean and the Journal icon drives smart navigation.

### 5.1 Clean the Plants card

- **Remove** the nested journal block from each planting card on the Plants tab (the "Journal (N)" section with up to 5 entries and "+N more").
- **Keep only** core data on the card:
  - **Status** (badge)
  - **Date** (sown_date)
  - **Location** (when present)
  - **Vendor** (from `grow_instances.vendor`; ensure fetch includes `vendor` in select)
- **Remove** from the card: seeds_sown, seeds_sprouted, plant_count, end_reason, and "Harvested N times" from the main card body so the card is minimal. (Optional: keep a single-line harvest count if desired; plan assumes remove for "clean" card.)
- Ensure `growInstances` fetch selects `vendor` so it can be displayed.

### 5.2 Contextual journaling

- **Ensure** the Journal tab feed is filtered to this profile only. Currently `journalEntries` is fetched with `.eq("plant_profile_id", id)`, so it is already scoped to this plant profile. Verify no other sources mix in entries; document that the Journal tab shows "events for this plant_id" (profile).

### 5.3 Smart navigation (Journal icon on planting card)

- When the user taps the **Journal icon** (replaced 📖 with `ICON_MAP.Journal`) on a planting card in the Plants tab:
  1. **Switch** the active tab to **Journal** (`setActiveTab("journal")`).
  2. **Scroll** the view to the start of this profile's journal timeline (e.g. ref to the Journal tab content container and `scrollIntoView({ behavior: "smooth" })` after a short `requestAnimationFrame` or `setTimeout` so the tab has rendered).
- **Implementation:** The Journal icon button currently opens `BatchLogSheet` (`setBatchLogTarget(batchForLog); setBatchLogOpen(true)`). Change behavior so that:
  - **Option A:** Tapping the Journal icon **only** switches to Journal tab and scrolls to timeline (no BatchLogSheet). "Add journal entry" is then available via Quick-Log from FAB or another entry point.
  - **Option B:** Keep BatchLogSheet for "quick log for this planting" and **also** switch to Journal tab and scroll after closing the sheet (or open sheet from Journal tab).
- **Recommendation:** Option A — Journal icon = "Go to this plant's journal timeline". Add-journal remains via FAB Quick-Log (with pre-selected plant when on this profile). Simpler and matches "Smart Navigation" copy.
- If Option A: remove or repurpose the Journal button's current `setBatchLogTarget`/`setBatchLogOpen` and use `setActiveTab("journal")` plus scroll to journal section (use a `ref` on the Journal tab content wrapper and scroll it into view).

### 5.4 Timeline polish (Journal tab)

- In the **Journal** tab, add a **thin vertical timeline line** connecting the entries to give a professional, architectural ledger feel.
- **Layout:** Use a left margin or padding for the line (e.g. a vertical bar or border-left) and align each entry card to the right of the line, with a small node (dot/circle) on the line for each entry. The line runs from top of first entry to bottom of last entry.
- **Implementation:** Wrap the list of journal entries in a container with `relative`. Draw a vertical line (e.g. `absolute left-[Xpx] top-0 bottom-0 w-px bg-neutral-200`). Each entry has a small circle on the line using **emerald-luxury** (`bg-emerald-luxury` or `border-2 border-emerald-luxury`); if token unavailable use `bg-[#50C878]`. Card content is offset to the right so the line doesn't overlap text. Use consistent spacing (e.g. `pl-6` or `pl-8` for content, line at `left-3`).

---

## 7. Unified Action Center — Journaling & Logging

**Scope:** Standardize the **Global Journal Entry** and the **Plant-Specific Log Modal** so both use the same layout and aesthetics ("Action Center").

**Targets:**

- **Global Journal Entry:** [src/app/journal/new/page.tsx](src/app/journal/new/page.tsx) — the full page reached via "Add journal" when not using Quick-Log, or when navigating directly to `/journal/new`. Redesign to match Action Center layout.
- **Plant-Specific Log Modal:** [src/components/BatchLogSheet.tsx](src/components/BatchLogSheet.tsx) — the slide-up sheet opened from the Plants tab (profile or garden). Redesign to match Action Center layout.
- **Quick-Log** (Section 2): When implemented inside UniversalAddMenu, use the same Action Center layout so all three entry points feel identical.

### 7.1 Unified layout (same for all three)

Apply this structure to both the Global Journal page and BatchLogSheet (and Quick-Log):

1. **Top section — Quick Actions row:** A **horizontal scrolling** row of buttons. Each button: icon + label, **rounded-xl**, **emerald-luxury** theme (e.g. `bg-emerald-luxury/10 text-emerald-luxury` or border variant), **strokeWidth 1.5** icons from `ICON_MAP`. Include:
  - Existing actions as applicable: Water, Fertilize, Spray, Growth, Note, Planting.
  - **Harvest:** Icon `ICON_MAP.Harvest` (minimalist basket/fruit).
  - **Pest/Issue:** Icon `ICON_MAP.Pest` (minimalist bug or alert triangle — add to styleDictionary per Section 1).
  - No emojis; all icons from the system dictionary.
2. **Middle section — Quick Memo:** A single **Quick Memo** text area (Markdown-friendly where relevant). Same styling across both: rounded-xl, consistent height/min-height.
3. **Bottom section — Photo Import:** **Photo Import** buttons using **sharp icons** from styleDictionary (e.g. `ICON_MAP.Camera` for Take Photo, a gallery/upload icon for From gallery). **rounded-xl**, emerald-luxury theme. Replace all emojis (📷, 🖼, 🌿, 🧴, 🧺, etc.) with `ICON_MAP` icons.

### 7.2 Smart pre-filling (Linked Plants)

- **When opened from a specific plant profile** (e.g. Quick-Log with `preSelectedProfileId`, or BatchLogSheet for one batch): **Pre-select** that plant in the "Linked Plants" section and **hide the search bar**. Show only the linked plant(s) as chips or read-only so the user sees context without clutter.
- **When opened from the Global FAB** (no plant context): Show the **Search/Select Plants** list clearly — search input + scrollable list of profiles so the user can link the entry to one or more plants.

### 7.3 Aesthetic consistency

- **Buttons:** Same **emerald-luxury** theme, **strokeWidth={1.5}** (via styleDictionary), **rounded-xl** corner radius everywhere in the Action Center.
- **Replace all emojis** with system icons (ICON_MAP). Audit [BatchLogSheet.tsx](src/components/BatchLogSheet.tsx) and [journal/new/page.tsx](src/app/journal/new/page.tsx) for 🌿, 🧴, 🧺, 📷, 🖼, etc., and substitute the corresponding icon component.
- **Photo buttons:** Use `ICON_MAP.Camera` for "Take photo" and a suitable icon for "From gallery" (e.g. image/upload from styleDictionary or add one if missing).

### 7.4 Implementation notes

- Consider extracting a shared **ActionCenterLayout** or **JournalEntryForm** component (Top / Middle / Bottom sections) used by Quick-Log, BatchLogSheet, and journal/new page to avoid drift. If not extracting, duplicate the structure and class names so the three UIs stay visually identical.
- BatchLogSheet currently has Growth milestones (germination, plant count, transplant) and Harvest as separate flows; preserve that logic but present Harvest and Pest/Issue in the Quick Actions row and keep Quick Memo + Photo at the same positions. Growth milestones can remain as a collapsible below Quick Actions or integrate into Quick Actions where it makes sense.

---

## 6. Build and test validation

- **Test suite (invisible stability):** A "Luxury" app isn't just about the UI; it's about stability. Run `**npm run test:run`** (or `npm run test:ci`). If the Style Dictionary or any change broke a unit test (e.g. plant creation), fix it before it hits the hillside. No merge/ship with failing tests.
- Run `**npm run build**` and fix any TypeScript, ESLint, or SVG issues.
- Fix any test or build failures before considering the polish complete.

---

## Summary table


| Area                 | Change                                                                                                                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Icons                | strokeWidth 1.5; Plant = leaf, Seed = rect + plus, Journal = lined paper; **add PestIcon**; Harvest = basket/fruit                                                                                                                                                                      |
| **Action Center**    | **Unified layout** for journal/new, BatchLogSheet, Quick-Log: Quick Actions row (incl. Harvest, Pest/Issue) → Quick Memo → Photo Import; emerald-luxury, rounded-xl, no emojis; **Smart pre-fill:** from profile = pre-select plant + hide search; from FAB = show Search/Select Plants |
| Journal              | Add journal opens Quick-Log modal; pre-select plant when on `/vault/[id]`; **onJournalAdded → router.refresh()** for immediate Journal tab update                                                                                                                                       |
| Add permanent plant  | Vendor above Date in existing flow; **Permanent:** "Confirm Planting", **Seasonal:** "Confirm Sowing"; ~15% less padding                                                                                                                                                                |
| Profile              | 📖 → ICON_MAP.Journal; journal tags **#50C878** (emerald-luxury or `text-[#50C878]` / `bg-[#50C878]/10`)                                                                                                                                                                                |
| Plants card          | Remove nested journal; keep Status, Date, Location, Vendor only                                                                                                                                                                                                                         |
| Journal tab          | Already filtered by plant_profile_id; add vertical timeline line                                                                                                                                                                                                                        |
| Journal icon on card | Switch to Journal tab + scroll to timeline (Option A: no BatchLogSheet)                                                                                                                                                                                                                 |
| Validation           | **npm run test:run** first (invisible stability), then npm run build; fix all failures                                                                                                                                                                                                  |


