# Form Add/Edit Parity Sweep — 2026-06-11

> Dispatch-spawned systemic sweep. Locks form parity as a pattern across Add/Edit flows
> instead of fixing per-finding nitpicks. Base: `origin/main` @ `c9ff972`, isolated worktree
> `chore/form-parity-sweep`.

---

## 1. Audit findings — parity matrix

Surfaces audited: AddPlantModal, AddPlantManualModal, Edit Plant Profile modal (vault/[id]),
"Edit Plant" editGrow modal (vault/[id]), PlantingForm, AddVarietyModal, QuickAddSeed
(SeedPacketForm), EditPacketModal, BatchAddSeed, QuickLogModal, NewTaskModal, QuickAddSupply,
vault/packets/[id] inline edit.

| Form | Submit button token | Loading state | Form-level error display |
|---|---|---|---|
| AddPlantModal | emerald-600/700 ✅ | SubmitLoadingOverlay ✅ | FormError ✅ |
| AddVarietyModal | emerald-600/700 ✅ | SubmitLoadingOverlay ✅ | FormError ✅ |
| QuickAddSeed | emerald-600/700 ✅ | SubmitLoadingOverlay ✅ | FormError ✅ (main) |
| QuickAddSupply | emerald-600/700 ✅ | SubmitLoadingOverlay ✅ | FormError ✅ (main) |
| NewTaskModal | emerald-600/700 ✅ | SubmitLoadingOverlay ✅ | FormError ✅ |
| QuickLogModal | emerald-600/700 ✅ | Overlay (upload phase) ✅ | ❌ plain `text-red-600` p (line 581) |
| Edit Plant Profile (vault/[id]:1044) | emerald-600/700 ✅ — but label `"Save Changes"` / `"Saving..."` (ASCII dots) | ❌ none | ❌ plain p (line 1043) |
| editGrow "Edit Plant" (vault/[id]:1613) | ❌ `bg-emerald-900 hover:opacity-90` | ❌ none | ❌ plain p (line 1607) |
| EditPacketModal | emerald-600/700 ✅, label "Save" ✅ | ❌ none (label swap only) | ❌ plain p (line 237) |
| AddPlantManualModal | ❌ `bg-emerald-900 hover:opacity-90 rounded-lg`, label `"Add packet"` (casing) | ❌ none | ❌ plain p (line 214) |
| PlantingForm | confirm-bar (own primitive, locked) | Seedling celebration (intentional) | ❌ plain p (line 909) |
| BatchAddSeed | emerald-600/700 ✅ | label swap (multi-step flow, own progress UI) | ❌ `text-citrus` p (save error) |
| vault/packets/[id] inline | n/a (auto-save on blur) | n/a | n/a (separate pattern) |

### Status-default findings (brief items 2 + 6) — VERIFIED RESOLVED, no code change

- All **6** `grow_instances` insert sites hardcode `status: "growing"`:
  [AddPlantModal.tsx:361](../../src/components/AddPlantModal.tsx) + :510,
  [PlantingForm.tsx:379](../../src/components/PlantingForm.tsx),
  [completeSowTask.ts:87](../../src/lib/completeSowTask.ts),
  [VaultPageContent.tsx:818](../../src/app/vault/VaultPageContent.tsx),
  [review-import/page.tsx:847](../../src/app/vault/review-import/page.tsx).
- Instance status enum collapsed to `growing|archived` by `67a6344` (Phase A). No path
  writes `"vault"` ("In storage") — that value exists only as a *profile* status option +
  derived packet-filter bucket. The "Add Plant defaults to In storage" bug landed silently.
- Profile statuses on create are explicit and semantically intentional per context:
  AddPlantModal → `active`; QuickAddSeed → `in_stock`; AddVarietyModal (no packet) →
  `out_of_stock`; PlantingForm new-variety → `in_stock`. Not drift — each reflects real
  inventory state. No omitted-status insert exists.

### Field-set parity (brief item 1) — ESCALATED, no code change (see §4)

---

## 2. Canonical pattern lock (NORTH_STAR justification)

One form primitive set, applied to every Add/Edit form ("**No duplicate paths**" — the
primitive IS the cohesion expression; a Save that looks/behaves differently per form makes
the same concept render two ways):

1. **Submit button**: `bg-emerald-600 hover:bg-emerald-700 text-white font-medium
   disabled:opacity-50` — already locked in VISION §8 (emerald CTA/SUBMIT split, FAB-form
   submit saga 2026-05-26, canonical across 40+ files). Radius: `rounded-xl` for edit-modal
   footers (anchor: EditPacketModal), `rounded-3xl` for FAB-tree forms (anchor: AddPlantModal).
2. **Edit-modal Save label**: `"Save"` / `"Saving…"` (ellipsis char) — anchor: EditPacketModal
   + editGrow already use it (2-of-3 prevailing pattern).
3. **Form-level error**: `<FormError>` — already locked in VISION §8 "Form-level error
   treatment" (2026-05-26): italic red + warning icon + role="alert", placed bottom-of-form.
   ("**Take mental load OFF the user**" — one consistent error voice; the user never has to
   re-learn what failure looks like per form.)
4. **Submit loading**: `<SubmitLoadingOverlay show={savingFlag} message="Saving…|Adding…">`
   mounted as last child of the `relative` modal panel — anchor:
   [AddPlantModal.tsx:1066,1076](../../src/components/AddPlantModal.tsx),
   AddVarietyModal:264,293, QuickAddSupply:728 (incl. its edit mode).

Intentional NON-targets (named so they don't read as missed):
- **PlantingForm** keeps the seedling-celebration as its submit feedback (existing locked
  pattern; adding the overlay would double-stack feedback).
- **BatchAddSeed** keeps its multi-step progress semantics (extraction progress bar +
  per-item annotations); only its form-level save error converges to FormError. Overlay
  deferred — its full-screen step layout isn't a `relative` modal panel.
- **QuickLogModal** overlay covers the upload phase only (insert is near-instant) — existing
  intentional choice, untouched.
- **vault/packets/[id]** inline auto-save is a different primitive (field-level persistence,
  no submit moment) — out of scope.

## 3. Files to change

| File | Changes |
|---|---|
| `src/app/vault/[id]/page.tsx` | editGrow Save: emerald-900→600/700; editGrow error p→FormError; editGrow overlay + `relative`; Edit Profile error p→FormError; Edit Profile overlay + `relative`; label "Save Changes"/"Saving..." → "Save"/"Saving…" |
| `src/components/EditPacketModal.tsx` | error p→FormError; SubmitLoadingOverlay + `relative` |
| `src/components/AddPlantManualModal.tsx` | button emerald-900→600/700 + rounded-lg→xl; label "Add packet"→"Add Packet" (casing lock); error p→FormError; overlay + `relative` |
| `src/components/PlantingForm.tsx` | error p→FormError (margin-preserving wrapper) |
| `src/components/QuickLogModal.tsx` | submitError p→FormError |
| `src/components/BatchAddSeed.tsx` | form-level `error` `text-citrus` ps→FormError (2 sites: capture step :954 + review step :1040; per-item `item.error` annotations kept) |
| `docs/plans/form_parity_sweep_2026-06-11.md` | this doc |

## 4. Escalations to Syd (no code shipped for these)

**E1 — Edit Plant field-set parity (brief item 1).** Recommendation: full Add↔Edit parity is
the WRONG lock here; the brief's default expectation doesn't survive the audit. The editGrow
"Edit Plant" modal edits the *instance record* (date/vendor/price/location/count); every
"missing" Add field already has a canonical edit path elsewhere — profile fields → Edit Plant
Profile modal; group → the three assignment doors (`c7fe6f6`); status → archive/restore +
End-batch flows (Phase A); photos/notes/supplies → journal. Adding them to editGrow would
*create* duplicate paths (NORTH_STAR "No duplicate paths").
**The one genuine gap:** "Number of plants" (`plant_count`) is collected for BOTH types at
Add ([AddPlantModal.tsx:364](../../src/components/AddPlantModal.tsx), default 1) but the edit
field is gated `isPermanent` ([vault/[id]/page.tsx:1564](../../src/app/vault/[id]/page.tsx)) —
seasonal plantings have NO edit path for plant count. Recommend un-gating (show the field for
all instances). One-line change; deferred because the gate may be intentional (seasonal counts
driven by thinning/journal instead). **Ask: un-gate plant_count in editGrow? (Recommended: yes.)**

**E2 — none other.** No schema/migration/RLS/auth touched anywhere in this sweep.

## 5. ADJACENT findings (Pass 3 — logged, not fixed this ship)

- `bg-emerald-900` on non-form CTAs: [vault/[id]/page.tsx:1318](../../src/app/vault/[id]/page.tsx)
  "Add Photo", [VaultProfilePacketsTab.tsx:47](../../src/app/vault/[id]/VaultProfilePacketsTab.tsx)
  — same token-lock violation class, outside Add/Edit-form scope.
- Step-level `importError` plain ps: QuickAddSeed:682, QuickAddSupply:452 — FormError lock
  covers form-level placement; step-level treatment needs its own micro-decision.
- Input corner-radius mixing (`rounded-lg` vs `rounded-xl`) inside editGrow / Edit Profile /
  AddPlantManualModal field inputs — input-primitive cohesion question, separate pass.
- QuickAddSeed primary label "Add to vault (with packet)" lowercase "vault" — possible casing
  drift vs Title Case button lock; survived prior sweeps so flagging, not flipping.

## 6. Regression risk per change

- **Source-reading layout tests** (`editModalFooter.layout.test.ts`,
  `vaultEditModal.layout.test.ts`) assert exact structural strings (z-[60], flex shells,
  `flex-shrink-0 px-6 py-4 pb-[max(...)]`, edit-status field order, pb-20, max-h caps).
  None of those strings are touched; button-className edits are inside the asserted shells.
  Verified by grep before edit.
- **e2e**: grep of `e2e/` for "Save Changes" / "Saving" / "Add packet" / "Save to Vault" —
  zero matches. No label assertions break.
- **Overlay additions**: reuse existing `saving` flags (no new state, no state-machine change
  → no bidirectional-trace matrix required); overlay is `absolute inset-0 z-10` inside the
  panel, so it cannot leak outside the modal; buttons already disable during save, overlay
  adds the visual layer only.
- **FormError conversions**: copy unchanged, markup converges; `{error && ...}` guards kept;
  original margins preserved via wrapper divs (FormError carries no margin).

## 7. Audit passes

- **Pass 1 (factual)**: every cited line verified by direct read this session (AddPlantModal
  361/364/1066/1076; vault/[id] 923/1043/1044/1046/1513/1564/1607/1613; EditPacketModal 237;
  AddPlantManualModal 214/231/234; PlantingForm 62/909; QuickLogModal 129/581; FormError
  contract; SubmitLoadingOverlay contract; 6 grow_instances inserts). Bidirectional
  state-transition matrix: N/A — no modal lifecycle/state-machine change (styling + display
  convergence on existing flags). **Clean.**
- **Pass 2 (concerns hunt)** — categories hunted: test coverage (layout tests — clean, see §6),
  e2e labels (clean), double-submit (no new state), null/empty error (FormError null-guard),
  overlay clipping/rounding (panel-internal, precedent accepted in AddVarietyModal),
  margin regressions (wrappers preserve), cohesion-by-aggregation (every change cites an
  anchor — §2), persona walk (Walter: clearer error + saving feedback; Maya: no added
  friction; Sydney: cross-form coherence; Aria/Sam: unaffected — no exclusions),
  mobile/desktop (overlay behaves identically). **Clean.**
- **Pass 3 (sibling sweep)**: the sweep IS the sibling alignment; ADJACENT register in §5.
  e2e-scope grep run (>10-label rule not triggered — 2 label edits, both grep-clean). **Clean.**
- **Pass 4 (lock hygiene)**: changes *enforce* VISION §8 locks (emerald CTA split, form-level
  error treatment, Title Case buttons) rather than touching them; no VISION §10/§11 or
  ROADMAP §6 conflicts; no contexts/nav/state machines. **Clean.**
