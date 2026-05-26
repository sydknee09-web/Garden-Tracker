# Form validation error styling polish

**Purpose:** Unify form-level validation/save-failure error display across FAB-tree primary forms — italic + red + small warning-icon prefix, replacing the current mix of yellow (`text-citrus`), amber (`text-amber-600`), and plain red (`text-red-600` without italic/icon). Bottom-of-form placement preserved per user lock (she's scrolled past the field by the time the error fires; inline-by-field would be missed).

**In-scope (6 render sites):**
- [NewTaskModal.tsx:426](src/components/NewTaskModal.tsx) — `text-citrus`
- [QuickAddSeed.tsx:939](src/components/QuickAddSeed.tsx) — SaveForLater path, `text-citrus`
- [QuickAddSeed.tsx:1073](src/components/QuickAddSeed.tsx) — ProceedToAdd path, `text-citrus`
- [AddPlantModal.tsx:963](src/components/AddPlantModal.tsx) — `text-red-600` (closer to target, but lacks italic + icon)
- [QuickAddSupply.tsx:677](src/components/QuickAddSupply.tsx) — `text-amber-600`
- [EditJournalModal.tsx:661](src/components/EditJournalModal.tsx) — `submitError`, `text-citrus`

**Out-of-scope (logged as ADJACENT for future polish pass):**
- Auth pages (login/signup/reset-password/update-password) — `text-citrus`, separate auth surface
- [AddPlantManualModal.tsx:220](src/components/AddPlantManualModal.tsx), [AddItemModal.tsx:128](src/components/AddItemModal.tsx), [FeedbackModal.tsx:398](src/components/FeedbackModal.tsx) — already `text-red-600` w/ role=alert, lack italic + icon
- [InviteMemberModal.tsx:111](src/components/InviteMemberModal.tsx) — settings surface, `text-citrus`
- [BatchAddSeed.tsx:937](src/components/BatchAddSeed.tsx) + [937, 1021] / [BatchAddSupply.tsx:471](src/components/BatchAddSupply.tsx) — batch variants; defer until cleanly outside any other in-flight scope
- [QuickAddSeed.tsx:939 webcamError-style sites](src/components/EditJournalModal.tsx) and per-item inline errors in BatchAddSeed — different shape (field-level inline), not form-level submit-blocked

**Acceptance:**
- All 6 in-scope render sites use a single shared `FormError` component
- Visual: `italic text-red-600 text-sm font-medium`, warning-icon prefix, role="alert"
- Bottom-of-form placement unchanged in all 6
- Tests pass (`npm run test:run`)
- Local build clean (`npm run build`)
- Preview MCP mobile-viewport screenshot on at least one site (NewTaskModal, easiest auth-OK route)
- VISION.md §8 captures the new convention so future form-builds inherit

## Files modified (8)

1. `src/lib/styleDictionary.tsx` — add `WarningIcon` (SVG, stroke="currentColor" so parent text color governs)
2. `src/components/FormError.tsx` — NEW, thin wrapper component
3. `src/components/NewTaskModal.tsx` — swap render site
4. `src/components/QuickAddSeed.tsx` — swap render sites ×2
5. `src/components/AddPlantModal.tsx` — swap render site
6. `src/components/QuickAddSupply.tsx` — swap render site
7. `src/components/EditJournalModal.tsx` — swap render site (submitError only; webcamError is field-level and out-of-scope)
8. `docs/VISION.md` §8 — add "Form-level error treatment" subsection

## Audit log

### Pass 1 — Factual (verifies references exist)
- `src/lib/styleDictionary.tsx` exports `ICON_MAP` ✓ (confirmed via Grep — only file in repo that does)
- All 6 render-site files exist + line numbers verified via Grep ✓
- `role="alert"` semantic available on `<p>` ✓ (already used in [AddPlantModal.tsx:963](src/components/AddPlantModal.tsx))
- Tailwind classes used (`italic`, `text-red-600`, `text-sm`, `font-medium`, `flex`, `items-center`, `gap-1.5`) are all valid utilities ✓
- `currentColor` SVG stroke colorizes via parent `text-*` class ✓ (browser standard)
- `addFlowError.ts` already documents the split: validation messages set directly, save/insert failures go through `formatAddFlowError()` ✓ — same render slot, both get the unified treatment (this is what the brief described as "current inline error messages")
- **Pass 1 result: clean.**

### Pass 2 — Concerns hunt (categories named, then checked)

Hunt categories for this code batch: cohesion-by-aggregation (new icon + new component); persona walk; state semantics (error state holds both validation AND save-failure messages — unified treatment correct?); test coverage; null/empty render gating; mobile vs desktop; a11y.

**Cohesion-by-aggregation:**
- `WarningIcon` is the FIRST error-semantic icon in `ICON_MAP`. Anchor: matches existing SVG shape convention (24×24 viewBox, stroke 1.2, function component, default aria-hidden). Deviation: uses `stroke="currentColor"` instead of `PRIMARY_GREEN` because color depends on parent context (red here, possibly amber/yellow if reused for warnings later). Documented in the icon's inline JSDoc.
- `FormError` is a NEW component. Anchor: not strictly present — but its purpose IS the convention. 6 forms × duplicated markup is the failure mode the component prevents. Justification documented in VISION §8.
- Italic-as-error is NEW visual semantic in this codebase. Anchor: none — Syd's call (locked in brief). Logged as VISION §8 design token so future forms inherit.

**Persona walk (Pass 2 sub-category per CLAUDE.md):**
- **Maya** (Power Gardener) — neutral; she rarely hits validation errors but if she does the clearer signal speeds re-submission. ✓
- **Sydney** (Spring-Planner Hobbyist) — improvement; consistent error treatment across all FAB-tree forms means she pattern-matches the signal faster on different forms. ✓
- **Walter** (Retiree Gardener) — improvement; red text + icon is more distinct than yellow text alone for someone who may have reduced contrast sensitivity. ✓
- **Aria** (Houseplant Urban User) — neutral; same as Maya. ✓
- **Sam** (First-Time Beginner) — improvement; red + icon is a clearer "blocked you from submitting" signal than yellow for someone newer to the app. ✓
- All 5 personas benefit or are neutral. No persona excluded.

**State semantics:** `error` state in each form holds BOTH validation messages ("Title is required.") AND save-failure messages (`formatAddFlowError(updateErr)`). Both render via the same `<p>{error}</p>`. The new treatment applies to both. This is correct because: (a) from user POV, all of them are "this is why your submit didn't go through" — same semantic; (b) [addFlowError.ts:3](src/lib/addFlowError.ts) confirms the split is purely about source (save vs validate), not visual treatment.

**Null/empty:** all 6 sites already gate render on `error &&` truthiness. Preserved in `FormError` usage. ✓

**Test coverage:** searched `src/__tests__` for the three validation message strings — none found. Tests don't assert on the validation text directly. `getByText`-style assertions (if added in future) would still match because `FormError` renders text as children inside `<span>` which Testing Library traverses through.

**Mobile vs desktop:** icon prefix is `flex-shrink-0`; text wraps naturally; no layout regression at narrow viewports. ✓ (verified via Preview MCP in execution step)

**a11y:** `role="alert"` is added to ALL 6 sites via FormError (currently only AddPlantModal has it). Net improvement for screen reader users. ✓

**Pass 2 result: clean** (all hunt categories returned no blocking concerns; cohesion-by-aggregation deviations are anchor-cited or doc-captured).

### Pass 3 — Sibling pattern sweep
Already executed during planning (above). Findings:
- **BLOCKING (in-scope):** 6 sites listed above
- **ADJACENT (logged for future polish pass):** 8 sites listed under "Out-of-scope"
- **CONCERN:** codebase has 3 different error-surface treatments currently (`text-citrus` × 8, `text-amber-600` × 1, `text-red-600` × 6 across all surfaces). This ship reduces to 2 (after-state: `FormError` on FAB-tree forms + ADJACENT mix elsewhere). Full sweep is a follow-up polish pass; not blocking this ship.

Vocabulary-breadth sub-rule sanity: searched `text-citrus|text-amber|text-red`, `Alert|Warning|Error|XCircle|AlertOctagon|CircleAlert`, `\{error &&`, `setError`, `formatAddFlowError`. No existing form-error abstraction was missed.

**Pass 3 result: clean.**

### Pass 4 — Lock hygiene
- VISION §10 don't-touch list — none triggered
- VISION §11 parked decisions — none triggered (closest: §7 Vault "Save/Cancel button consistency" is parked but separate decision)
- VISION §8 design tokens — ADDING a new subsection ("Form-level error treatment"). Not overriding an existing locked token. The closest existing convention is "Field treatments — dropdown vs free-text" (locked 2026-05-24); the new form-error subsection is a parallel sibling, not a conflict.
- ROADMAP §6 — no locked decision conflicts.

**Pass 4 result: clean.**

## Execution order

1. Add `WarningIcon` to styleDictionary
2. Create `FormError` component
3. Swap 6 render sites
4. Update VISION §8
5. `npm run test:run` — expect green (438 baseline per brief)
6. `npm run build` — expect clean
7. Preview MCP mobile-viewport screenshot (412×915) on NewTaskModal trigger via Calendar FAB
8. Commit (single, descriptive)
9. Push
