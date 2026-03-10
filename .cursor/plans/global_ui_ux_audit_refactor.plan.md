# Global UI/UX Audit and Refactor — Locked Spec

**Standard:** Refined Architectural Luxury. Execute in order; run tests after Step 1 and Step 2 before proceeding.

---

## Locked Master Prompt (for Cursor Composer)

Copy-paste this to run the refactor:

```
Execute a global UI/UX Refactor following 'Refined Architectural Luxury' standards.

1. Feedback & Toasts:
- Create a Global Toast Component/Provider (Emerald-900 for success, Neutral-800 for removal).
- Wire all Creation paths (Plant, Seed, Supply, Journal) to Success Toast + hapticSuccess().
- Wire all Completion paths (Tasks, Shopping List) to strike-through + hapticClick() (50ms). NO TOASTS.
- Wire all Destruction paths to a Confirmation Sheet + 'Item Removed' Neutral Toast.

2. Navigation & Loading:
- Remove 'Skip' from vault/import/manual/page.tsx.
- Add top-left Back arrows and centered titles to all FAB sub-menus (QuickAdd, NewTask).
- Fix Vault 'Select' flicker using bg-emerald-50 and transition-colors.

3. Forms & Data:
- Migration: Add vendor and price columns to supply_profiles. Update types.
- Shed UI: Add a 2-column grid for Vendor/Price. Use existing Espoma sack placeholder.
- Labels: Remove '(optional)'. Use red * ONLY for: Plant Name, Seed Variety, Product Name, Task Title, Journal Note.
- Empty States: Use thin-line icons (stroke 1.2) + 'No entries yet' text.

4. Visual & Tactile:
- Colors: Force all primary green accents to #064e3b.
- Buttons: Standardize order (Primary Right/Top, Cancel Left/Bottom) + active:scale-95.
- Icons: Update styleDictionary.tsx and all Lucide imports to strokeWidth: 1.2 and color #064e3b.

5. Testing:
- Run the full test suite after Step 1 and Step 2.
- Ensure the new Toast API doesn't break existing interaction tests.
- If a refactor touches a button that has an existing test, that test must pass before moving to the next section.
```

---

## Locked Technical Variables

### 1. Skip
- **Target:** [src/app/vault/import/manual/page.tsx](src/app/vault/import/manual/page.tsx) — hero step only.
- **Directive:** Remove the "Skip" button. Leaving = "Cancel" or Back arrow only. No other onboarding/splash target for now.

### 2. Shed Data (vendor / price)
- **Directive:** Add columns to `supply_profiles` now so the 2-column UI is not empty.
- **Migration:** `vendor` (string, nullable), `price` (numeric/float, nullable).
- **Types:** Update [src/types/garden.ts](src/types/garden.ts) `SupplyProfile` with `vendor?: string | null` and `price?: number | null`.
- **Rationale:** Foundational for future "Price per Gallon" analytics.

### 3. Required-Field Asterisks
- **Rule:** Red `*` only on the **minimum field needed to create a DB record** per entity. Everything else stays clean (no "(optional)", no asterisk).
- **Mapping:**
  - **Plant:** Name *
  - **Seed:** Variety/Name *
  - **Supply:** Product Name *
  - **Task:** Title *
  - **Journal:** Note/Content *
- No asterisks on: Price, Vendor, NPK, Location, or other optional fields.

### 4. Icon Scope ("Luxury Stroke")
- **Directive:** Global visual style — same fine-point pen everywhere.
- **Apply:** `strokeWidth: 1.2` and `#064e3b` to:
  - **styleDictionary.tsx** default icon props.
  - **Every** lucide-react import used in the app.
- Outcome: Entire icon language feels consistent.

### 5. Testing Mandate
- **After Step 1 (Feedback & Toasts):** Run full test suite. Fix or add tests for Toast API and any touched creation/completion/deletion flows.
- **After Step 2 (Navigation & Loading):** Run full test suite again. Any refactor that touches a button with an existing test — that test must pass before moving to the next section.
- Do not proceed to the next major section with failing tests.

---

## Implementation Order

1. **Step 1 — Feedback & Toasts** (then run tests)
2. **Step 2 — Navigation & Loading** (then run tests)
3. **Step 3 — Forms & Data** (migration, Shed grid, labels, empty states)
4. **Step 4 — Visual & Tactile** (colors, buttons, icons)
5. **Step 5 — Testing** (final suite run; fix regressions)

---

## Key Files Reference

| Area | Files |
|------|--------|
| Toast | New: `Toast.tsx` + provider; `layout.tsx` or `AuthGuard.tsx` |
| Haptics | `src/lib/haptics.ts` — add `hapticClick(50)` |
| Skip | `src/app/vault/import/manual/page.tsx` |
| FAB / Back + title | `UniversalAddMenu.tsx`, `QuickAddSeed.tsx`, `QuickAddSupply.tsx`, `NewTaskModal.tsx` |
| Vault Select flicker | `VaultPageContent.tsx` (toolbar), `SeedVaultView.tsx` (row selection: `bg-emerald-50` + `transition-colors`) |
| Migration | New: `supabase/migrations/YYYYMMDD_supply_profiles_vendor_price.sql` |
| Types | `src/types/garden.ts` — SupplyProfile |
| Shed 2-col | `src/app/vault/shed/[id]/page.tsx`, edit form (QuickAddSupply or inline) |
| Labels | All form components — remove "(optional)"; add * per locked mapping |
| Empty states | `EmptyState.tsx`, SeedVaultView, PacketVaultView, ShedView, journal, shopping-list, vault pages, CareScheduleManager, MyPlantsView, ActiveGardenView |
| Colors | `globals.css`, `styleDictionary.tsx`, all `emerald-*` / green accent usage |
| Buttons | Modals/sheets: Primary right/top, Cancel left/bottom; all primary: `active:scale-95` |
| Icons | `styleDictionary.tsx` (defaults); grep `lucide-react` and set strokeWidth 1.2, color #064e3b |
