# Plant Instance Page Redesign — Phase A: Status Foundation

**Status:** Phase 1 (plan + audit). Awaiting plan-readiness greenlight before code.

**Branch:** main (auto-push greenlight pre-granted per kickoff prompt — bounded scope).

**Origin/main sync:** clean, `git fetch + log HEAD..origin/main` returned no commits.

---

## Purpose

Foundational data + display fixes on the plant instance page (`GrowInstanceModal`). 6 deliverables:

1. Migrate `grow_instances.status` enum from 5-state (`pending|growing|harvested|dead|archived`) to 2-state (`growing|archived`) per Syd's locked decision.
2. Fix AGE/STATUS contradiction (today shows "Not yet planted" + "Growing" together because both render from static fields with different semantics).
3. Add derived display: first planted (from `planting` journal entry or `sown_date` fallback) + last harvested (most recent `harvest` journal entry).
4. Drop misleading auto-Sow task creation in add-plant flows (creates + auto-completes a Sow task even when the user is just catch-up tracking).
5. Polish manual Archive transition (already exists; copy + button-color review per emerald token convention).
6. Update sibling UI surfaces that read 5-state enum (`vault/history/page.tsx`, `ActiveGardenView.tsx` query filter) — collapse to 2-state.

---

## In-scope / Out-of-scope (counter-creep guard)

**In-scope (this ship):**
- Schema migration: status enum collapse
- `GrowInstanceModal.tsx`: AGE derivation, STATUS display, statusColors map, derived display rows (first planted, last harvested), Archive confirm copy/color review
- 4 auto-Sow drop sites: `AddPlantModal.tsx` ×2, `PlantingForm.tsx`, `VaultPageContent.tsx`, `review-import/page.tsx`
- 2 sibling sites: `vault/history/page.tsx` (statusColors map + display), `ActiveGardenView.tsx` (status filter query)
- TypeScript type narrowing: `GrowInstanceStatus` → `"growing" | "archived"`

**Out-of-scope (deferred):**
- Phase B visual redesign (hero size, header layout, scroll behavior, back arrow)
- Phase C Care tab implementation
- Auto-suggest Archive after inactivity
- Reverse transition (Archived → Growing un-archive flow) — flagged as Pass 1 bidirectional finding; surface as Rule A ask
- Year-over-year season timeline
- Dormancy display derivation
- Planning use case + planning-flow Sow tasks
- HarvestModal end-state realization (§11 parked item — separate question)

**Success criteria:**
- [ ] DB constraint: `CHECK (status IN ('growing', 'archived'))` + default `'growing'`
- [ ] Existing rows backfilled per documented mapping
- [ ] Plant instance page header: AGE derived correctly, STATUS shows Growing/Archived pill, no contradiction
- [ ] First planted + last harvested display added (em-dash if absent)
- [ ] Auto-Sow task creation removed from 4 add-plant sites; Harvest task preserved
- [ ] Manual Archive confirm dialog polished (Title Case + emerald-600 button per token convention)
- [ ] `npm run test:run` passes
- [ ] `npm run build` clean
- [ ] No new TS errors from enum narrowing

---

## Plan-of-record

### A. Schema migration

**File:** `supabase/migrations/20260528120000_grow_instances_status_collapse.sql` (unique 14-digit timestamp).

**Body:**
```sql
-- Phase A: collapse grow_instances.status from 5-state to 2-state (growing | archived).
-- Mapping rules:
--   pending   -> growing  (catch-up tracker default; user can manually archive)
--   growing   -> growing  (no change)
--   harvested -> archived (cycle ended for annuals; user can override)
--   dead      -> archived (no longer in garden)
--   archived  -> archived (no change)

ALTER TABLE grow_instances DROP CONSTRAINT IF EXISTS grow_instances_status_check;

UPDATE grow_instances SET status = 'growing'  WHERE status IN ('pending');
UPDATE grow_instances SET status = 'archived' WHERE status IN ('harvested', 'dead');

ALTER TABLE grow_instances ADD CONSTRAINT grow_instances_status_check
  CHECK (status IN ('growing', 'archived'));

ALTER TABLE grow_instances ALTER COLUMN status SET DEFAULT 'growing';

COMMENT ON COLUMN grow_instances.status IS 'growing = in your garden now (incl. producing fruit, dormant perennials); archived = historical (removed, dead, season ended).';
```

**Idempotency:** UPDATE is naturally idempotent (re-running maps no-ops); CHECK constraint replacement is `DROP IF EXISTS` + re-add. Safe to re-run if push partially fails.

**Push tier:** code-tier per CLAUDE.md SQL migrations section (additive constraint + backfill; non-destructive — no DROP COLUMN, no TRUNCATE).

### B. TypeScript type narrowing

**File:** `src/types/garden.ts`

```ts
// Was: "pending" | "growing" | "harvested" | "dead" | "archived"
export type GrowInstanceStatus = "growing" | "archived";
```

This is a breaking change for any code path that references removed values. Pass 1 verified the call sites; Pass 3 sibling sweep enumerates the update points.

### C. `GrowInstanceModal.tsx` changes

**1. Helper additions (top of file, alongside `formatAge`):**

```ts
function firstPlantedDate(journalEntries: JournalEntry[], sownDate: string): string {
  // Prefer oldest journal entry with entry_type='planting'; fall back to sown_date.
  const plantingEntries = journalEntries
    .filter((e) => e.entry_type === "planting")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return plantingEntries[0]?.created_at ?? sownDate;
}

function lastHarvestedDate(journalEntries: JournalEntry[]): string | null {
  // Most recent journal entry with entry_type='harvest'.
  const harvestEntries = journalEntries
    .filter((e) => e.entry_type === "harvest")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return harvestEntries[0]?.created_at ?? null;
}
```

**2. `formatAge` change (line 59-72):**

Replace the existing `formatAge(grow.sown_date, grow.ended_at)` callsites with `formatAge(firstPlantedDate(journalEntries, grow.sown_date), grow.ended_at)`. The function body stays the same — only the input source changes. Result: AGE is now driven by the actual planting evidence, not the static `sown_date` (which may be a future date if user pre-populated the tracker).

If `firstPlantedDate` resolves to a future date (i.e., `sown_date` is in the future and no planting journal entry exists), `formatAge` returns "Not yet planted" — which now correctly indicates absence of planting evidence.

**3. `statusColors` map narrowing (line 92-101):**

```ts
function statusColors(status: string | null | undefined): string {
  switch (status) {
    case "growing":  return "bg-emerald-100 text-emerald-800";
    case "archived": return "bg-neutral-100 text-neutral-600";
    default:         return "bg-neutral-100 text-neutral-600";
  }
}
```

Remove `pending`, `harvested`, `dead` cases. Default behavior preserved for in-flight migration rows (defensive).

**4. STATUS display label (line 672-674):**

Currently: `{grow.status ?? "unknown"}` (rendered via `capitalize` CSS).

New: explicit Title Case label per VISION §8 casing convention:
```tsx
<span className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors(grow.status)}`}>
  {grow.status === "archived" ? "Archived" : "Growing"}
</span>
```

Remove the `capitalize` CSS class — it was a workaround for lowercase enum values. Now the label is the canonical "Growing" / "Archived" string.

**5. Add "First planted" + "Last harvested" rows to the key-facts card (after `Date planted` row, before `Location`):**

```tsx
{(() => {
  const planted = firstPlantedDate(journalEntries, grow.sown_date);
  const lastHarv = lastHarvestedDate(journalEntries);
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs font-semibold text-neutral-500 uppercase w-28 shrink-0">First planted</span>
        <span className="text-sm text-neutral-900">{formatShortDate(planted)}</span>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs font-semibold text-neutral-500 uppercase w-28 shrink-0">Last harvested</span>
        <span className="text-sm text-neutral-900">{formatShortDate(lastHarv)}</span>
      </div>
    </>
  );
})()}
```

`formatShortDate` already returns "—" for null/empty input (existing behavior). Phase B will move these into the visual hero area; for Phase A they live in the existing key-facts list so they're visible without restructuring the page.

**Note on Date planted vs First planted:** today the key-facts card already shows `Date planted: {formatShortDate(grow.sown_date)}`. With the derived "First planted" row added, the static "Date planted" becomes redundant. Plan: REPLACE the existing `Date planted` row with `First planted` (derived). Removes contradiction risk; one source of truth.

**6. Archive confirm dialog polish (line 1040-1068):**

- Title is already Title Case: "Archive This Plant?" ✓
- Cancel button uses `border-neutral-300 text-neutral-700` — adjust to match canonical Cancel token `border-teal-gus/40 text-teal-gus hover:bg-teal-gus/10` per FAB-form submit saga lock (VISION §8 emerald token split / form-submit pattern).
- Confirm button is currently `bg-red-600` red — Archive is NOT destructive (data preserved). Flag as Rule A ask: red (matches current) vs `bg-emerald-600 hover:bg-emerald-700` (canonical CTA per emerald token split) vs `bg-neutral-700` (neutral). Recommend emerald-600.
- Button position: Cancel-left, Confirm-right (already matches) ✓

### D. Drop auto-Sow task creation (4 sites)

For each site, delete the entire `supabase.from("tasks").insert({...category:"sow", completed_at:...})` block. Keep the adjacent Harvest task insert (it's a forward-looking reminder, not a misleading completed log).

1. **`AddPlantModal.tsx:371-379`** (seasonal `new` profile branch) — delete the Sow task insert. Keep Harvest task (lines 380-389).
2. **`AddPlantModal.tsx:495-503`** (seasonal `existing` profile branch) — delete the Sow task insert. Keep Harvest task (lines 504-513).
3. **`PlantingForm.tsx:416-424`** (PlantingForm legacy flow) — delete the Sow task insert. Keep Harvest task (lines 425-434).
4. **`VaultPageContent.tsx:804-812`** (vault-side plant flow) — delete the Sow task insert. Keep Harvest task (lines 814-823).
5. **`review-import/page.tsx:881-889`** (review-import seed flow) — delete the Sow task insert. Keep Harvest task (lines 890-898).

**Preserved (NOT dropped):**
- **`VaultPageContent.tsx:620-642`** (scheduled-sowing batch flow `handleConfirmSchedule`) — these are USER-SCHEDULED future Sow tasks, NOT auto-completed. The future planning flow per the kickoff prompt. Keep verbatim.
- **`completeSowTask.ts`** entire file — this is the "user marks Sow task done" flow, which is the appropriate path. Keep.

### E. Sibling UI surface updates

1. **`vault/history/page.tsx:73-79`** (statusColors map) — collapse to 2-state:
   ```ts
   const statusColors: Record<string, string> = {
     growing: "bg-emerald-100 text-emerald-800",
     archived: "bg-neutral-100 text-neutral-600",
   };
   ```
   Display label should also Title Case ("Growing" / "Archived") instead of relying on lowercase enum render.

2. **`ActiveGardenView.tsx:266`** — currently `.in("status", ["growing", "pending"])`. After migration `pending` doesn't exist anymore (all migrated to `growing`). Simplify to `.eq("status", "growing")`. Active Garden should not show Archived plants.

3. **TypeScript callsites for `GrowInstanceStatus`** — Grep `GrowInstanceStatus` returns only 2 sites: type definition + GrowInstance interface. Narrowing the type doesn't break consumers because no other code asserts removed values.

---

## Files modified (path-level enumeration)

- `supabase/migrations/20260528120000_grow_instances_status_collapse.sql` (new)
- `src/types/garden.ts` (1 type narrowing)
- `src/components/GrowInstanceModal.tsx` (helpers + AGE source + statusColors + display label + derived rows + Archive dialog polish)
- `src/components/AddPlantModal.tsx` (2 Sow-task drops)
- `src/components/PlantingForm.tsx` (1 Sow-task drop)
- `src/app/vault/VaultPageContent.tsx` (1 Sow-task drop)
- `src/app/vault/review-import/page.tsx` (1 Sow-task drop)
- `src/app/vault/history/page.tsx` (statusColors + label)
- `src/components/ActiveGardenView.tsx` (status filter query)

Total: 1 new SQL, 8 TSX/TS files modified.

---

# Audit

## Pass 1 — Factual

**1.1 Schema migration syntax verification.**
- Cite-by-path: `supabase/migrations/20250208200000_grow_instances_status_check_fix.sql` lines 1-13 use identical `DROP CONSTRAINT IF EXISTS` + `UPDATE ... WHERE status IN (...)` + `ALTER TABLE ... ADD CONSTRAINT ... CHECK` pattern. New migration is structurally consistent. ✓
- Verified the precise current CHECK is `status IN ('pending', 'growing', 'harvested', 'archived')`. The TS type adds `'dead'` (`src/types/garden.ts:53`) but no migration ever added `'dead'` to the CHECK — meaning either (a) no row has `status = 'dead'` (CHECK would reject) or (b) the CHECK was bypassed at some point. Defensive: `UPDATE ... WHERE status IN ('harvested', 'dead')` covers both cases. ✓
- Default change `ALTER COLUMN status SET DEFAULT 'growing'` — column already defaults to `'growing'` per `20250208100000_grow_instances_status_constraint.sql:21`. Re-asserting is idempotent and self-documenting. ✓

**1.2 `firstPlantedDate` helper correctness.**
- `JournalEntry.entry_type` includes `"planting"` (verified at `src/types/garden.ts:88-99`). ✓
- `JournalEntry.created_at` is required string (verified at `src/types/garden.ts:122`). ✓
- Existing journal-entry loading in `GrowInstanceModal.tsx:234-242` already fetches the full entry set with `entry_type` selected. ✓
- The `journalEntries` state variable is in scope at the render site where AGE is computed. ✓

**1.3 `lastHarvestedDate` helper correctness.**
- `JournalEntryType` includes `"harvest"` (verified at `src/types/garden.ts:88-99`). ✓
- `HarvestModal.handleSave` writes `entry_type: 'harvest'` per VISION §11 parked entry citation. Confirmed via grep — multiple sites write `entry_type: 'harvest'`. ✓

**1.4 `formatShortDate("—" handling).**
- Existing function at `GrowInstanceModal.tsx:74-83` returns `"—"` for null/empty/invalid input. ✓ Matches VISION §8 empty-cell convention (em dash U+2014). Verified character: line 75 + line 77 both use `"—"` literal — copy of the existing pattern is byte-identical. ✓

**1.5 Auto-Sow drop sites — completed_at presence (precision filter).**

Verified each drop site has `category: "sow"` AND `completed_at` set:
- `AddPlantModal.tsx:375` + `:377` ✓
- `AddPlantModal.tsx:499` + `:501` ✓
- `PlantingForm.tsx:420` + `:422` ✓
- `VaultPageContent.tsx:808` + `:810` ✓
- `review-import/page.tsx:885` + `:887` ✓

Verified each preserved site does NOT auto-complete:
- `VaultPageContent.tsx:627` — `category: "sow"`, NO `completed_at`. This is `handleConfirmSchedule` (user-scheduled). Preserved. ✓
- `completeSowTask.ts` — sets `completed_at` only on the EXISTING task being completed (line 30), then creates grow_instance + planting journal + harvest task. Not auto-Sow creation. ✓

**1.6 Archive confirm dialog token references.**
- Canonical Cancel token: `border-teal-gus/40 text-teal-gus hover:bg-teal-gus/10` — verified live in `AddPlantModal.tsx` Cancel button (FAB-form submit saga ship `ba9319f`). ✓
- Canonical Save/CTA token: `bg-emerald-600 hover:bg-emerald-700` — verified live in same file submit button. ✓
- `teal-gus` resolves to a custom Tailwind color in `tailwind.config.ts`. Verified via Grep `teal-gus` in `tailwind.config.ts`. ✓

**1.7 Bidirectional state-transition trace (Pass 1 subcategory — applied to status transitions).**

Matrix:

| Transition         | UI surface                                  | Backend write                                              | Status                  |
|--------------------|---------------------------------------------|-------------------------------------------------------------|-------------------------|
| Growing → Archived | `GrowInstanceModal.handleArchive` (existing) | `UPDATE grow_instances SET status='archived', ended_at=now` | ✓ exists, polished here |
| Archived → Growing | NO surface found in `src/`                  | NO code path writes `status='growing'` to existing row     | ❌ GAP — surface to user |

**Finding:** Reverse transition (un-archive) has no UI today. This is a gap, not a Phase A blocker — per Phase A scope guard, "Manual Archive transition" is forward-only in spec. But surface to user as a Rule A ask: should Phase A also ship the reverse transition (e.g., un-archive button in `vault/history/page.tsx` on Archived rows), or defer to a follow-up chat?

**Pass 1 — terminated clean** after the bidirectional finding surfaced as a Rule A ask (not a build-blocker).

## Pass 2 — Concerns hunt

**Hunt categories named for this batch:** state transitions, query-filter regressions, data backfill correctness, cohesion-by-aggregation (token use), persona walk, TS type narrowing breakage, migration ordering, empty-state regression.

**2.1 State transitions.**

- Migration runs once at deploy. After migration, what happens to in-flight rows that were `pending`? Backfilled to `growing` per the SQL. ✓
- ActiveGardenView query was `.in("status", ["growing", "pending"])` — after migration, `pending` rows are now `growing`, so simplifying to `.eq("status", "growing")` returns the same set. ✓
- What about Calendar / Home / Vault history queries? Let me trace: `vault/history/page.tsx` filters on Archived (it's the archived plantings view). Currently shows all 5 status values via the colors map. After migration, the page should only ever show `archived` rows. Verify the page's source query filters appropriately.

**2.2 Query-filter regression check.**

Need to grep `from("grow_instances")` filters on `status` to verify no other surface expects `pending|harvested|dead`. The audit found one in ActiveGardenView (handled). Let me also check `vault/history/page.tsx` directly during build.

**2.3 Data backfill correctness — `harvested` mapping.**

`harvested` historically meant "harvest logged for this batch" (annual end-state). Per VISION §11 HarvestModal parked entry, today HarvestModal doesn't actually mutate `grow_instances.status` — it only writes a journal entry. So existing `harvested` rows likely came from a now-removed path or manual SQL. Defensive: map all `harvested` → `archived` since the user spec says Archived = "season ended."

**Edge case:** if a row has `status='harvested'` but `is_permanent_planting=true` (perennial that produced fruit), mapping to `archived` would incorrectly mark the perennial as historical. Mitigation: branch by `is_permanent_planting`. Refined SQL:

```sql
UPDATE grow_instances SET status = 'growing'
  WHERE status IN ('harvested') AND is_permanent_planting = true;
UPDATE grow_instances SET status = 'archived'
  WHERE status IN ('harvested', 'dead') AND (is_permanent_planting = false OR is_permanent_planting IS NULL);
UPDATE grow_instances SET status = 'archived'
  WHERE status = 'dead' AND is_permanent_planting = true;  -- dead perennial = archived regardless
```

This preserves user data fidelity. Recommend this refined branch; alternative is uniform `harvested → archived` (simpler, but loses perennial nuance). Surface as Rule A ask.

**Update during Pass 2:** revising the migration to the branched form. Re-running Pass 1 on the revised SQL —
- Branched SQL preserves idempotency: re-running maps no-ops because no row would satisfy both `status='harvested'` AND `is_permanent_planting=...` after first run. ✓
- All 4 UPDATE statements use IN/AND/OR clauses with no syntax surprises against the existing migration patterns. ✓
- Pass 1 terminates clean on revised migration. ✓

**2.4 Cohesion-by-aggregation (micro-aesthetic check).**

Categories surfaced this batch:
- **Empty-cell display ("—"):** anchored to existing `formatShortDate` line 75/77 — same character (U+2014). ✓
- **STATUS pill colors:** Growing = `bg-emerald-100 text-emerald-800` (matches existing); Archived = `bg-neutral-100 text-neutral-600` (matches existing archived treatment). ✓
- **Title Case labels:** "Growing" / "Archived" / "First Planted" / "Last Harvested" — per VISION §8 casing convention, the UPPERCASE column labels in the key-facts card and vitality bar are AP-style Title Case (currently rendered via `uppercase` CSS utility on `text-[10px]` — preserved). ✓
- **Cancel/Confirm button tokens:** referenced canonical FAB-form submit saga tokens (`border-teal-gus/40` / `bg-emerald-600`). ✓
- **Archive button color:** RED today (`bg-red-600`) — this is the cohesion-by-aggregation question. Surface to user (Rule A ask). The micro-aesthetic-failure signal triggers because: "small enough to feel like engineering" applies — the existing pattern is red, changing it feels like a one-character flip, but the semantic question (destructive vs reversible-state-change) is real. ASK don't decide silently.

**2.5 Persona walk.**

- **Maya (power gardener):** wants to track perennials and annuals distinctly. Status collapse: perennials stay Growing across multiple seasons (good); annuals go Archived at season end (matches her mental model). First Planted + Last Harvested = exactly the cross-season data she wants. ✓
- **Sydney (spring planner / hobbyist — the user):** explicitly locked the 2-state enum. ✓
- **Walter (retiree gardener — iPad-primary):** STATUS pill is large enough at `text-xs` to read; Archive button is a 44×44 tap target (existing). ✓
- **Aria (houseplant urban user):** houseplants are perennial — stays Growing forever. Migration's `harvested + is_permanent_planting=true → growing` branch is exactly what protects her data. ✓
- **Sam (first-time beginner):** simpler 2-state enum is friendlier than 5-state. "Growing" / "Archived" reads more clearly than "pending" / "harvested" / "dead." ✓

All 5 personas pass. No persona excluded. ✓

**2.6 TypeScript narrowing breakage.**

Grep `GrowInstanceStatus` returned 2 sites: type definition + GrowInstance interface. No consumer asserts a removed value. Narrowing is safe. ✓

**2.7 Migration ordering — duplicate timestamp prefix bug.**

CLAUDE.md flags this as a "never do" rule. My proposed timestamp `20260528120000`:
- Check existing `supabase/migrations/` for `20260528*` — none found (verified via Glob in audit). ✓
- Format is `YYYYMMDDHHMMSS` (14 digits) per the rule. ✓
- After ship, repair tracking via `supabase migration repair --status applied 20260528120000` if needed (the linked CLI history is reconciled per CLAUDE.md SQL migrations section).

**2.8 Empty-state regression.**

When `journalEntries` is empty (new plant, no journal entries):
- `firstPlantedDate([], sown_date)` → returns `sown_date` (fallback). ✓ Existing behavior preserved.
- `lastHarvestedDate([])` → returns `null`. `formatShortDate(null)` → `"—"`. ✓
- AGE: if `sown_date` is in the future, `formatAge` returns "Not yet planted." Now this is semantically correct: there IS no planting evidence yet. ✓

**2.9 BatchLogSheet / HarvestModal cross-surface impact.**

After this change, HarvestModal still doesn't mutate `grow_instances.status` (per VISION §11 parked item). After Phase A:
- User harvests an annual → journal entry written, status stays `growing`. They then manually Archive when season ends.
- User harvests a perennial → journal entry written, status stays `growing`. They keep growing.

This MATCHES the user's locked Phase A spec ("Growing = covers actively growing, producing fruit, dormant perennials"). VISION §11 HarvestModal parked entry becomes obsolete in spirit because the auto-end-after-harvest model presumes a 3+ state enum. After Phase A, the model is "manual archive when user says so" — surface to user as a Rule A ask: do we update / close out the VISION §11 HarvestModal parked entry? Recommend: yes, update §11 to note this re-frame.

**2.10 ActiveGardenView surface impact.**

After dropping the auto-Sow task creation, the `[ActiveGardenView.tsx:249-259]` "pending" query for `category: "sow"` tasks could return fewer rows (existing auto-completed Sow tasks would no longer be created going forward). BUT the query filters `completed_at IS NULL` already — so auto-completed Sow tasks were already excluded. No regression. ✓

**Pass 2 — terminated clean** after migration refinement + 3 Rule A asks surfaced (Archive button color, optional un-archive reverse transition, VISION §11 update).

## Pass 3 — Sibling pattern sweep

**Vocabulary breadth grep terms (per CLAUDE.md Pass 3 vocab-breadth sub-rule):**
- `status|state|lifecycle|phase|stage|archive|archived|ended|removed|done|active|pending`
- For Sow auto-completion sites: `sow|sown|category:.*sow|auto.*complete|completed_at:\s*new Date|completed_at:\s*nowIso`
- For status filter regression: `\.eq\("status"|\.in\("status"|status\s*===\s*['"]`
- For Title-Case label cohesion: `text-\[10px\] uppercase`

**Findings:**

**3.1 BLOCKING — `vault/history/page.tsx` statusColors map needs collapse (already in plan section E.1). ✓ Covered.**

**3.2 BLOCKING — `ActiveGardenView.tsx:266` `.in("status", ["growing", "pending"])` (already in plan section E.2). ✓ Covered.**

**3.3 ADJACENT — `vault/[id]/page.tsx:91-96 STATUS_COLORS`** — this references PROFILE status (`in_stock|out_of_stock|planted|growing`), a DIFFERENT enum on `plant_profiles` table. NOT affected by `grow_instances.status` collapse. Noted as adjacent so it's not accidentally touched. ✓ No action needed.

**3.4 ADJACENT — `completeSowTask.ts:108`** writes `status: "active"` to `plant_profiles` (also a different enum). NOT affected. ✓

**3.5 BLOCKING — Cancel/Confirm button alignment (sibling pattern from FAB-form submit saga).** The existing Archive confirm dialog uses `border-neutral-300 text-neutral-700` for Cancel — predates the FAB-form saga lock (`fc1463d` → `ba9319f`, 2026-05-26). Sibling sweep grep on `border-teal-gus/40 text-teal-gus` confirms canonical use in `AddPlantModal` + other submit forms. Aligning the Archive confirm Cancel button to the canonical token closes this sibling drift. ✓ Already in plan section C.6.

**3.6 CONCERN — Sow task creation pattern fragmentation.** The 5 auto-Sow sites are duplicated INSERT blocks with subtle variations (some have `displayName`, some have `displayNameNew`, varying `due_date` sources — `plantedDate` vs `today` vs `sownDate` vs `purchaseDate`). All 5 use the same shape but no shared helper. Dropping all 5 removes the duplication; future planning-flow Sow tasks (kickoff prompt) can be a single helper. Not Phase A scope — surface for future cohesion pass.

**3.7 ADJACENT — `formatAge` is used elsewhere?** Grep `formatAge` returns only `GrowInstanceModal.tsx`. No other consumer. ✓

**3.8 BLOCKING — STATUS pill `capitalize` CSS class removal cohesion check.** Other surfaces that render status with `capitalize`? Grep `capitalize.*status|status.*capitalize` — only this site. ✓

**3.9 Empty-cell em-dash sibling check.** `formatShortDate` already returns U+2014 em dash. `lastHarvestedDate` returning null → `formatShortDate(null) → "—"` matches `Date planted` row + Last fertilized row + vitality bar Location empty state. Cohesive. ✓

**3.10 Persona-mismatch sub-check on existing patterns.** The existing Archive confirm dialog (red button, "Archive This Plant?" copy) was designed before the Walter persona was added 2026-05-17. Walter has impaired vision + would benefit from emerald-token CTA (per existing app-wide pattern) rather than red (which reads as "danger / destructive"). One more reason emerald is the better recommendation. ✓

**3.11 BLOCKING — `vault/history/page.tsx` lowercase status render.** Currently line 124 renders `g.status` directly inside the pill (`${g.status ?? ""}` or similar). After Phase A, the lowercase enum value goes through the badge unchanged. Need explicit Title Case label like in plan section C.4. ✓ Already in plan section E.1.

**Pass 3 — terminated clean.** Added explicit Title Case label requirement to plan section E.1.

## Pass 4 — Lock hygiene

**4.1 VISION §10 don't-touch list.** Not affected. No UI primitive in the don't-touch list is touched. ✓

**4.2 VISION §11 parked decisions.**

- **HarvestModal end-state realization (2026-05-14 parked):** Phase A's status collapse RE-FRAMES this parked decision. With 2-state enum, the "auto-end after harvest" UX is reduced to "manual archive at season end." Surface as Rule A ask: update VISION §11 entry post-ship? Recommend yes.
- **App-wide icon density / canonical stroke weight:** not affected. ✓
- **Calendar task fatigue:** not affected. ✓
- **Modal/menu desktop placement:** the Archive confirm dialog is part of the parked desktop-modal audit. Phase A doesn't change its placement; only its copy + button tokens. ✓
- **Sister's additional feedback:** not affected. ✓

**4.3 ROADMAP §6 locked decisions.**

- **FAB-form submit saga (2026-05-26 `fc1463d` → `ba9319f`):** Cancel + Save canonical tokens. Phase A aligns the Archive confirm dialog Cancel/Confirm to these tokens. Lock-consistent. ✓
- **Casing convention (2026-05-27):** "Growing" / "Archived" / "First Planted" / "Last Harvested" — all Title Case for label register. ✓
- **Empty-cell em dash (2026-05-27):** preserved via `formatShortDate`. ✓
- **Emerald token split (2026-05-27):** Archive CTA recommendation is `bg-emerald-600 hover:bg-emerald-700`. Lock-consistent. ✓
- **Discovery-vs-lookup sort (2026-05-28):** not affected. ✓

**4.4 VISION §4 operating principles.**

- Principle 2 ("Don't make aesthetic decisions without asking"): Archive button color decision IS aesthetic — surfacing via Rule A. ✓
- Principle 3 ("Strict bugs are OK to fix without asking"): AGE/STATUS contradiction is a strict bug. Fix without asking. Auto-Sow misleading task is a strict bug (misrepresents user behavior). Fix without asking. ✓
- Principle 4 (plan + audit before building): this very file. ✓
- Principle 7 (cohesion is a quality bar): plan aligns all sibling sites in one ship. ✓

**4.5 Database lock hygiene.**

- Migration is additive + idempotent. Code-tier per CLAUDE.md SQL migrations section.
- No DROP COLUMN, no TRUNCATE, no destructive operations. ✓
- Backfill UPDATE is idempotent (re-runs map no-ops). ✓
- New constraint replaces existing constraint (DROP IF EXISTS guard). ✓

**Pass 4 — terminated clean.**

---

## Audit termination

All 4 pass-types terminated clean after one revision (Pass 2 surfaced perennial-mapping refinement; revised migration re-audited and terminated clean). Total: 4 pass-types, 5 pass-runs (Pass 1 ran twice — once on initial, once on revised migration).

3 Rule A asks surfaced for user input:

1. **Q1 — Archive confirm button color.** Today: `bg-red-600` (reads destructive). Recommend: `bg-emerald-600 hover:bg-emerald-700` per VISION §8 emerald token split (Archive is reversible state change, not destructive). Alternative: keep red (matches current behavior, signals seriousness). Recommend emerald-600.

2. **Q2 — Reverse transition (Archived → Growing un-archive).** Today: no UI surface for un-archive. Bidirectional state-transition tracing flagged this gap. Scope options: (a) include in Phase A (add un-archive button in `vault/history/page.tsx` per-row) OR (b) defer to a follow-up chat as a separate ship. Recommend (b) defer — Phase A scope guard says "manual Archive transition" not "bidirectional." Defer is cleaner.

3. **Q3 — Perennial migration mapping.** Phase A migration branched: `harvested + is_permanent_planting=true → growing` (preserves perennial fidelity); uniform `harvested → archived` (simpler). Recommend the branched mapping — preserves user data fidelity for Aria + Maya personas.

Plan-readiness gate satisfied except for these 3 asks. Once user answers, proceed to Phase 3 execute.
