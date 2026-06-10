# Plan — Groups feature follow-up ship (tabs / 3 doors / auto-journal / FAB cleanup / annual-perennial / Adding-hang / delete-group)

> **Status:** PLAN-DOC PHASE — no code yet. Awaiting Syd review + greenlight + 2 decisions (§3).
> **Branch (when greenlit):** `feat/groups-followup` (feature branch per push-tier rule).
> **Anchor docs:** VISION.md §3 (disclosure-by-data), §6 Theme 4 (disorientation / cross-layer traversal), §8 (single-state tab-slot lock 2026-06-01; info-note treatment; emerald split; casing) · CLAUDE.md (bidirectional state-transition trace; plan-audit 4 passes; push tiers) · gt_v1_scope.md.
> **Date:** 2026-06-09.

---

## 0. Sprint-label discrepancy (flagged, non-blocking)

The brief calls this "First Sprint 2 build chapter — Groups feature work." Per `gt_v1_scope.md` (canonical), the Groups feature (MUST #1, IA Ship B) **already shipped in Sprint 3** (`f5c7c76` B1 schema → `04ef744` B2 GroupTabs → `cb6f050` B3 Manage modal + AddPlantModal autocomplete → `0b73ec7` B4 → `ecc541e`), and Sprints 4–5 are closed. So the "Sprint 2" label is stale. **The actual work is polish + bug-fix + feature-extension on the already-shipped Groups feature** (the brief itself references "the Groups field already exists," "Manage Groups modal," "tabs break at 4+"). Substance is coherent and builds on Sprint 3; only the sprint number is wrong. Proceeding on substance. (Logged per `feedback_verify_brief_vs_locked_plan.md` governance.)

---

## 1. Purpose + scope

**Purpose:** Close the sister-bounce friction around plant location tracking + organization by hardening + extending the Groups feature — fix the tabs scaling break, give three discoverable ways to assign a plant to a group (each auto-journaled), clean up the multi-select FAB, relocate the annual/perennial edit to the Library, fix the Manage-modal "Adding" hang, and handle delete-group-with-plants.

**In scope (9 items):** tabs scaling fix · 3 assignment doors · auto-journal on every group change · multi-select FAB cleanup · annual/perennial relocation · "Adding" hang fix · delete-group-with-plants edge case · defaults preserved.

**Out of scope (explicit):** merge groups (deferred v2 per brief item 8) · a 4th assignment door · Move/Status as journal quick actions (held by Syd) · changing the tabs pattern itself (locked VISION §8) · re-theming any locked token.

**Success criteria:** A user can put a plant in a group via any of 3 doors; every change writes a compact auto-journal entry with correct Added/Moved/Removed language; tabs render cleanly at 1→6+ groups with Manage pinned + a scroll fade; the Manage modal never hangs on Add; deleting a group with plants reassigns them first; the Perennial pill is gone from Garden cards and annual/perennial is edited at the Library entry; opt-in defaults are untouched.

---

## 2. Code map (verified — Pass 1 factual anchors)

| Concern | File / symbol | Notes |
|---|---|---|
| Tab row + Manage button | `GroupTabs.tsx:85-157` | Container `flex … overflow-x-auto scrollbar-hide`; **Manage button is INSIDE the scroll flex** (`shrink-0`), no fade. Active token `bg-white text-emerald-700 shadow-sm`. |
| Manage modal | `ManageGroupsModal.tsx` | `handleCreate:87-104` (`creating` flag, label `{creating ? "Adding…" : "Add"}` at 265-271); `handleReorder:179-201` (optimistic, **never sets row.saving**); reorder arrows `disabled={…|| row.saving}` 297-322; `handleDelete:135-177` (**no has-plants prompt**); `reload:67-80`. |
| Groups data layer | `lib/groups.ts` | `fetchUserGroups`, `fetchInstanceGroups`, `assignInstanceToGroup:62-84`, `unassignInstanceFromGroup:87-108`, `createGroup`, `renameGroup`, `updateGroupPositions:158-177` (sequential loop), `deleteGroup:185-211` (hard-delete `plant_groups` → soft-delete `groups`), `fetchAllUserGrowInstances`. |
| Schema | `supabase/migrations/20260529130000_groups_and_plant_groups.sql` | `groups` (soft-delete `deleted_at`, `position`, `UNIQUE(user_id,name)`). `plant_groups` (M-N, **hard-delete**, `UNIQUE(grow_instance_id, group_id)` → multi-membership allowed; trigger enforces user_id match). |
| Garden filter + cards | `GardenView.tsx` | `filteredByGroup:488-491` (ungrouped show in "all" only); `isPerennial = batch.is_permanent_planting === true` (1111/1214) drives **pill 1164-1167/1318 + Planted-vs-Sown text + progress bar + care/harvest counts**; bulk methods `moveSelectedToPermanentPlants:833` / `moveSelectedToGrowingGarden:857`; `useImperativeHandle:881-888`; bulk selection = `bulkSelected` Set. |
| Door 1 (Add Plant) | `AddPlantModal.tsx:935-1007` | **Multi-select** `selectedGroupIds:string[]`; pills + ×; "+name" add; inline "Create" ; `assignSelectedGroupsToInstance` fires after insert (366/513). Field sits between Location and Photos — normal weight (the "buried" perception). |
| Door 2 (plant page) | `GrowInstanceModal.tsx` | Opened via `?grow=` (a modal, not a route). Location inline-editor pattern `765-793` (tappable text → input + save check; state `editingLocation`/`locationDraft`/`savingLocation`; `saveLocation:410-420`). **No group tag shown today.** |
| Door 3 + cleanup | `app/garden/page.tsx` | Batch action sheet `1075-1158`: Mark perennial (1094), Mark annual (1106), Delete (1115), End batch (1127), Journal (1143). `handleMoveSelectedPerennial:391-402`. FAB `1160-1209`. GroupTabs+GardenView wiring. Quick-log journal insert ~600-700. |
| Annual/perennial (variety) | `plant_profiles.profile_type` | `CHECK (profile_type IN ('seed','permanent'))`, comment "seed = seasonal from seed packets; permanent = trees, perennials, established plants." Backfilled `is_permanent_planting` from it (mig `20250314…`). **Variety-level data EXISTS** (brief correct). Not currently editable on Library page. |
| Journal | `journal_entries` | `entry_type text` with **CHECK constraint** `(planting,growth,harvest,note,care,pest,death,quick,vault_add,prune,cold_stratify)`. Render precedence `journal/page.tsx getActionForGroup:124-136`; **no auto-vs-user visual distinction today**; **no shared insert helper** (inline inserts). |

---

## 3. Architectural decisions needed before code (the 2 genuine forks)

Per the brief's instruction ("ask Syd in plain text before proceeding — don't pattern-match into a guess"), two questions are not resolvable from the brief. Recommendations marked; I'll proceed on the recommendation only if Syd doesn't redirect.

### Decision A — Group membership model: single vs multi (THE blocker)

**The conflict.** The shipped Door 1 (AddPlantModal) is **multi-select** — a plant can be in many groups (`selectedGroupIds: string[]`; schema `UNIQUE(grow_instance_id, group_id)` permits N rows per plant). But the brief's auto-journal spec and Doors 2/3 are written in **single-group** terms: *"group cleared, back to unassigned," "Moved {Old} → {New}," "a Group tag … tappable to change," "Move to group."*

**Why it matters.** "Moved A → B" only has meaning if a plant has one group at a time. With multi-membership, a "move" is really remove-one + add-one, and Door 2's "a Group tag" becomes "N group tags."

**Recommendation: single-group membership as the canonical model.** It matches the brief's entire auto-journal design + Door 2 + Door 3 + the user's "one place this plant lives" mental model, and keeps "All + groups" reading like folders. Consequence: reconcile shipped Door 1 from multi-select to **single-select** (small change — pills → one selected chip). Auto-journal then maps cleanly to Added/Moved/Removed.

**Alternative: keep multi-membership.** A plant can be in "Raised Bed 1" *and* "Salsa Garden." Real and useful. But then auto-journal "Moved" is dropped in favor of per-event "Added to X" / "Removed from X" (no Moved), Door 2 shows multiple tags, and Door 3 "Move to group" needs to mean either *add* or *replace-all* (another sub-decision). More flexible, less tidy, and diverges from the brief's locked language.

**This is the one true blocker** — the auto-journal logic, Door 2 UI, and Door 3 semantics all branch on it. The rest of the plan below is written assuming **single-membership (recommended)**; if Syd picks multi, I re-audit the auto-journal + Door 2/3 sections.

### Decision B — Annual/perennial: terminology + editor placement (item #5)

**Grounded:** the variety-level field is `plant_profiles.profile_type` ('seed' | 'permanent'). It already drives lifecycle paths. The brief's "data still exists per Library entry" is correct.

**Two wrinkles, both with defensible defaults:**
1. **Terminology.** profile_type is *seed/seasonal* vs *permanent (trees/perennials/established)* — not literally "annual/perennial." **Recommend** the Library editor edits the existing `profile_type` using the app's existing seed/permanent language (don't introduce a parallel annual/perennial taxonomy that would fork the data model). I'll label it clearly; flagging in case Syd wants the literal "Annual/Perennial" words on the control.
2. **Editor UI (aesthetic — Rule 4).** profile_type isn't editable on the Library page today. **Recommend** a two-option segmented control / toggle in the Library entry's edit surface, anchored to existing field treatments (VISION §8 dropdown-vs-free-text → this is a preset choice → gray-filled select/segmented). Confirm placement (Library profile edit form) + control style.

**Minimal-scope note:** the Perennial pill removal + batch-action removal are unambiguous and I'll do them regardless. The instance flag `is_permanent_planting` stays as the card display-branch driver (Planted-vs-Sown / progress bar) — only its *pill* and its *batch editing* are removed; it becomes creation-time-derived only. After this ship the canonical editable answer is `profile_type` at the Library.

### Decision C (minor, defensible default) — auto-journal compact treatment + Door 1 "emphasize"

Both are aesthetic (Rule 4). Defaults below; will proceed unless redirected.
- **Auto-journal visual:** anchor to VISION §8 **info-note treatment** (`text-sm text-neutral-600 italic`, no fill/border) + a small system icon, reduced card padding (`p-3` vs `p-4`) and a one-line "Auto-logged" affordance. Keyed off `entry_type === 'group_change'`. (Brief says treatment is TBD-in-implementation + "informational, not narrative" — info-note is the exact existing primitive for that.)
- **Door 1 "emphasize":** move the Groups field directly under the plant name/identity (above Location) and give it the section a subtle heading, rather than burying it mid-form between Location and Photos. No new tokens — reuse existing label/field styles.

---

## 4. Per-item implementation plan

### Item 1 — Tabs scaling fix (`GroupTabs.tsx`)
- Restructure the row into: **[ scrollable strip (All + group tabs) ] [ fixed Manage button ]** using a flex parent where the strip is `flex-1 min-w-0 overflow-x-auto scrollbar-hide` and Manage is `shrink-0` *outside* the scroll container.
- Add right-edge **fade**: an absolutely-positioned gradient overlay (`pointer-events-none`, `bg-gradient-to-l from-white`) at the right of the strip, between strip and Manage, shown when content overflows. (Anchor: plain Tailwind gradient; no new token.)
- Keep the active-tab token (`bg-white text-emerald-700 shadow-sm`) and the §8 single-state pill primitive intact.
- Verify render at 1/2/3/4/5/6+ groups (the "breaks at 4+" today is the Manage button being pushed off by the in-scroll layout — pinning it fixes the break).

### Item 2 — Three doors

**Door 1 (Add Plant):** make single-select (per Decision A) + emphasize per Decision C. Group assignment already fires post-insert (`assignSelectedGroupsToInstance`); reroute it through the shared assign helper (Item 3) so it auto-journals. New plant → first assignment → "Added to X."

**Door 2 (`GrowInstanceModal.tsx`):** add a tappable **Group tag** in the Key-facts area (after Location, ~line 793) matching the Location inline-edit pattern: read state = current group name (or "Add to a group"); tap → inline picker (list of groups + "No group / Unassigned" + inline "Create"); select → call shared assign/move/remove helper → auto-journal → optimistic update + `onMutated`-style refetch. New state vars mirror `editingLocation`/`savingLocation`.

**Door 3 (`app/garden/page.tsx` + `GardenView.tsx`):** add "Move to group" to the batch sheet → opens a **destination group picker** bottom-sheet (each group + "No group / Unassigned"). On pick → new GardenView ref method `assignSelectedToGroup(groupId | null)` iterating `bulkSelected`, each via shared helper (move/remove + auto-journal per plant). Anchor the picker to existing modal/sheet shells; emerald-600 CTA per §8.

### Item 3 — Auto-journal on every group change
- **New `entry_type` value `'group_change'`** via additive migration (DROP+ADD CHECK with superset) — sibling pattern to `vault_add`/`prune`/`cold_stratify` migrations. (Migration → greenlight-gated per push tier.)
- **New shared helper** `lib/createJournalEntry.ts` (anchored to the existing inline insert shape) used by all 3 doors.
- **Central assignment helpers** in `lib/groups.ts` extended (or new `setInstanceGroup`) so every door funnels through one place that: computes prior group → applies change → writes the correct entry. Language (sentence-case body, group names preserved):
  - no group → group: `Added to {New}`
  - group A → group B: `Moved {Old} → {New}`
  - group → none: `Removed from {Old}`
- Journal card: compact branch on `entry_type === 'group_change'` (Decision C visual). Add `'group_change'` to `getActionForGroup` precedence + an ActionIcon mapping.

### Item 4 — Multi-select FAB cleanup (`app/garden/page.tsx`)
- Remove "Mark as perennial" (1094-1105) + "Mark as annual" (1106-1114) + `handleMoveSelectedPerennial` + the two GardenView ref methods `moveSelectedToPermanentPlants`/`moveSelectedToGrowingGarden` (and their `useImperativeHandle` entries) if unused elsewhere (verify via Pass 3).
- Add "Move to group" (Door 3).
- Final order per brief: **Move to group · Journal · End batch · Delete.**

### Item 5 — Annual/perennial relocation (per Decision B)
- Remove Perennial pill spans: `GardenView.tsx:1164-1167` (grid) + `1318` (list). Keep `isPerennial`/`is_permanent_planting` driving display text + progress (do NOT remove those branches).
- Do NOT add a Group pill to cards (brief).
- Add `profile_type` editor on the Library entry (Decision B control).

### Item 6 — "Adding" hang fix (`ManageGroupsModal.tsx`)
- **Fix #1 (race):** single modal-level `busy` flag; while any save (create/reorder/rename/delete) is in flight, disable Add + all reorder arrows + delete buttons. Kills the race trigger (reorder-during-create).
- **Fix #2 (timeout):** wrap saves with an N-second timeout (propose **10s**); on timeout abort the pending state, show `FormError` "Couldn't add — try again," re-enable the menu. (Anchor: VISION §8 FormError primitive.)
- **Fix #3 (optimistic):** show the new group row instantly, reconcile on resolve; revert + error on failure. (Pattern already used by `handleReorder`.)
- **Fix #4 (cosmetic):** reserve Add-button width for the widest label ("Adding…") via fixed min-width / `tabular`-style sizing so it never overflows the modal edge.

### Item 7 — Delete group with plants
- Before delete, count assigned plants for the group (query `plant_groups` by `group_id`). If **>0** → prompt "{Group} has N plants. Where should they go?" with a picker (each other group + "No group / Unassigned") → confirm → reassign all (via shared move helper, **auto-journaling each**) → then `deleteGroup`. If **0** → existing clean delete (no prompt).
- Note: today `deleteGroup` hard-deletes `plant_groups` rows (orphaning silently). New flow reassigns first so history + auto-journal are correct.

### Item 9 — Defaults preserved (verification, not code)
- Opt-in: new users see only "All" + Manage (already true — `GroupTabs` maps empty groups). No forced setup. "All" default. New plants → no group unless assigned (single-select default empty). Ungrouped show in "All" only (`filteredByGroup:488-491`). Verify each in Phase 4.

---

## 5. State-transition map — group assignment (3 doors × add/change/remove)

Assuming **single-membership (Decision A recommended)**. `prior` = plant's current group (or none).

| Door | Trigger | prior=none | prior=A (→B) | prior=A (→none) |
|---|---|---|---|---|
| **D1 Add Plant** | new instance + group chosen | insert plant_groups(B); journal `Added to B` | n/a (new plant has no prior) | n/a |
| **D2 Plant page** | tap Group tag → pick | insert(B); `Added to B` | delete(A)+insert(B); `Moved A → B` | delete(A); `Removed from A` |
| **D3 Batch move** | pick destination for N plants | per-plant: insert(dest); `Added` | per-plant: delete+insert; `Moved` | per-plant: delete; `Removed` (dest = "No group") |
| **Item 7 delete-group** | reassign-then-delete | — | per-plant: delete(A)+insert(dest); `Moved A → dest` | per-plant: delete(A); `Removed from A` (dest = "No group") |

**Single shared path:** all four routes call one `setInstanceGroup(instanceId, nextGroupId|null)` that reads `prior`, mutates `plant_groups`, and emits the correct journal entry. One code path = one place to get the language right.

---

## 6. Pass 1 — Factual + bidirectional state-transition trace

### 6a. Factual (verified above)
- All cited symbols/lines confirmed by direct read (§2). `profile_type` CHECK + `entry_type` CHECK confirmed via migration grep. `is_permanent_planting` drives multi-branch render (not just pill) — confirmed `GardenView:1111,1197-1201,1223,1318,1332-1346`.
- Migration needed for `'group_change'` (CHECK constraint blocks unknown values otherwise — this is the kind of factual gap Pass 1 exists to catch).

### 6b. Bidirectional trace — stateful surfaces (modal/menu lifecycle)

**Manage Groups modal (Item 6)** — matrix: rows = transitions, cols = React axes.

| Transition | state/reconcile | mount/unmount | race/async |
|---|---|---|---|
| Open modal | `open` true → fetch `reload()` | focus-trap mounts | n/a |
| Add (optimistic) | append row + `busy=true` → resolve reconciles / reject reverts | row mounts immediately | **busy locks all other saves** (fix #1) |
| Add timeout | 10s → abort pending, FormError, `busy=false` | row stays optimistic? → must revert on timeout | timeout vs late-success: late success ignored once aborted (guard with a token) |
| Reorder | optimistic swap → resolve/revert | none | blocked while `busy` |
| Delete (0 plants) | row → `saving` → remove on resolve | row unmounts | blocked while `busy` |
| Delete (N plants, Item 7) | open reassign picker → reassign all → delete | picker mounts/unmounts | reassign batch must finish before delete; `busy` spans both |
| Close modal | `open` false | focus-trap unmounts; **pending optimistic state discarded** | if close mid-save → must not write after unmount (cancelled flag) |

**Bidirectional concern caught:** Add-timeout vs late-success (forward: optimistic add; reverse: timeout abort) — the late network success must not re-insert a row after abort. Guard each save with a local request token; ignore resolutions whose token is stale. Same guard for close-mid-save (the modal already uses a `cancelled` pattern in `GroupTabs` fetch — mirror it).

**Door 2 inline editor (GrowInstanceModal)** — open-edit / pick / save / cancel / close-modal-mid-save. Reverse paths: cancel restores prior tag; close-mid-save uses cancelled flag. Mirror the existing `saveLocation` lifecycle exactly (it already handles these).

**Door 3 picker + batch** — open picker / pick / apply-to-N / close. Reverse: close picker pre-pick = no-op; partial batch failure → surface error, refetch to reconcile actual state (don't leave optimistic lies). Trace each of the N plants through add/change/remove per §5.

---

## 7. Pass 2 — Concerns hunt + cohesion + persona walk

**Hunt categories (code batch):** state transitions ✔ (§6b), race/double-fire ✔ (busy flag + request tokens), null/empty/many ✔ (0 groups, 1 group, 10-cap, plant with no group, group with 0/N plants), missing query filters (group counts must filter `deleted_at` on groups + scope `user_id`), optimistic-vs-refetch mismatch ✔ (reconcile on resolve), RLS/auth (plant_groups trigger enforces user match — assign helper must pass correct user_id), mobile-vs-desktop (tabs scroll + fade on phone widths; picker bottom-sheet thumb-reachable), test coverage (new helper + entry_type + single-membership swap), **cohesion-by-aggregation** (below), **persona walk** (below).

**Concerns surfaced:**
1. **Multi→single Door 1 migration of existing data.** If Syd picks single (A), existing plants may already have multiple plant_groups rows (from shipped multi-select). Single-select UI must handle "plant already in 2 groups" gracefully (show first? show all but let pick one?). **Resolution:** read decision A first; if single, Door 2 shows all current memberships read-only with a note, but editing collapses to one. No destructive backfill in this ship. Flag.
2. **Group count query for Item 7** must count distinct `grow_instance_id` in `plant_groups` where `group_id=X` (and the instances not archived? — decide: count all assigned; reassign all rows). Confirm archived-instance handling.
3. **`is_permanent_planting` becomes non-editable** post-ship (batch actions removed). Acceptable per Decision B, but means a plant mis-classified at creation can't be flipped from Garden anymore — only `profile_type` at Library changes future behavior, not existing instances' flag. **Flag as accepted trade-off** (or add instance-level override later).
4. **Auto-journal volume.** Batch Door 3 over N plants writes N journal entries. For large N this floods the journal. **Resolution:** acceptable (each is compact + informational; matches "every change is journaled"). Note for Syd; could later collapse into one multi-plant entry (defer).

**Cohesion-by-aggregation (anchor or ask each):**
- Tab fade: plain `bg-gradient-to-l from-white` — no existing fade token; **new micro-pattern → flagged** (Decision-adjacent; low risk, but naming it).
- Picker sheet: anchor to existing modal/bottom-sheet shell (reuse, don't reinvent).
- Auto-journal style: anchor VISION §8 info-note (Decision C).
- CTA color: emerald-600 per §8 emerald split (CTA lane).
- Journal language frame: sentence case per §8 casing; "Moved {Old} → {New}" uses an en-dash/arrow — **propose `→` (U+2192)**, flag (cohesion).

**Persona walk (VISION §3 disclosure-by-data; PERSONAS.md):**
- **Maya (power):** multi→single could annoy if she wants a plant in 2 groups → Decision A directly affects her; surfaced.
- **Sydney (=Syd, cohesion):** 3 doors must feel like one concept; shared helper + consistent language deliver that.
- **Walter (iPad, tap-only):** Door 2 tag + Door 3 picker are tap-first (no swipe). Tabs need visible Manage + fade (discoverability). 44×44 targets preserved.
- **Aria (houseplant):** Groups = "rooms"/"shelves" for her — works without outdoor assumption. Annual/perennial relocation reduces clutter on her cards (pill gone). Good.
- **Sam (beginner):** opt-in preserved — empty state shows only All + Manage; no forced setup. No cliff. Good.

---

## 8. Pass 3 — Sibling sweep

**Perennial/Group pill siblings:** grep confirmed pill only in `GardenView.tsx` (grid 1164-1167, list 1318). No other surface renders a Perennial pill. **BLOCKING-clear** — both sites in one file. (Will re-grep `Perennial` app-wide at build to confirm no Library/profile/calendar sibling.)

**Multi-select action-sheet siblings:** the batch sheet in `app/garden/page.tsx` is the only Garden multi-select sheet. Calendar/Shopping use the swipe primitive (different concern). Verify no other surface calls `moveSelectedToPermanentPlants` before deleting those methods (grep `moveSelectedTo`).

**Add Plant flow variants:** AddPlantModal serves Manual / From Vault / Established paths (per gt_v1_scope #5 shared extraction). The Groups field is unconditional (§2), so single-select + emphasize applies to all three paths in one edit. Verify the Established + From-Vault paths render the same field block.

**Journal insert siblings:** existing inline inserts (`vault_add`, `planting`, `note`) — the new `createJournalEntry` helper should match their column shape; do NOT retrofit existing call-sites in this ship (scope), just add the helper + use it for group_change. ADJACENT: existing inline inserts could later adopt the helper (separate cohesion ticket).

**E2E scope (CLAUDE.md Pass 3 e2e sub-rule):** Door 1 single-select + removed batch labels ("Mark as perennial"/"Mark as annual") + new "Move to group" label may break Playwright assertions. **Grep `e2e/` for** `Mark as perennial|Mark as annual|Perennial|getByText.*[Gg]roup` and update specs in the same ship. Required — source-only sweeps leave e2e dangling (the rule's whole point).

---

## 9. Pass 4 — Lock hygiene
- **VISION §8 single-state tab-slot (2026-06-01):** tabs fix must preserve the pill primitive + active token; pinning Manage outside the scroll does not change the toggle primitive. ✔ compliant.
- **VISION §8 emerald split / casing / FormError / info-note:** all reused, not redefined. ✔
- **Door 1 shipped behavior (`cb6f050`):** changing multi→single edits shipped behavior → gated behind Decision A (surfaced, not silent). ✔
- **Held items:** Move/Status journal **quick actions** stay un-built (brief). Door 3 batch "Move" is a different surface — allowed. ✔
- **VISION §3 / disclosure-by-data:** opt-in defaults preserved (Item 9). ✔
- **Migration:** `group_change` CHECK extension is additive/idempotent (code-tier SQL) but still `db push`-gated → greenlight. ✔

---

## 10. Push tier + verification gates
- **NOT auto-push** (touches user data via journal writes + group reassignments + a migration + multiple UI surfaces). Feature branch `feat/groups-followup`.
- **Phase 4 before report:** `npm run test:run` (+ new tests for the shared helper + single-membership transitions + entry_type), `npm run build`, sibling-scan grep clean (Perennial app-wide + e2e specs updated), bidirectional trace re-walked against final code.
- **Migration:** apply `db push` only after explicit greenlight (additive CHECK extension).
- Report commit SHA + results to Syd; **wait for explicit greenlight before pushing to main.**
- No screenshots (per brief — tests + build + trace sufficient).

---

## 11. Open decisions for Syd (plain-English; recommendations marked)

1. **Membership model (BLOCKER).** Single group per plant *(Recommended — matches your auto-journal Added/Moved/Removed language + Door 2 "a Group tag" + Door 3 "Move to group"; reconciles shipped Door 1 to single-select)* — vs — multi-group per plant (a plant can live in 2+ groups; drops the "Moved" wording for per-event Added/Removed, Door 2 shows N tags, Door 3 "Move" means add-or-replace). Everything downstream branches on this.
2. **Annual/perennial (item #5).** Edit the existing `profile_type` (seed/permanent) at the Library entry with the app's existing seed-vs-permanent wording, via a gray-filled segmented control in the profile edit surface *(Recommended — uses the real variety field, no parallel taxonomy)* — vs — relabel the control literally "Annual / Perennial." Either way: pill removed from Garden cards, batch actions removed.
3. **Auto-journal look + Door 1 emphasis (defaults, will proceed unless redirected).** Auto-journal entries render as compact info-notes (VISION §8 `text-sm text-neutral-600 italic` + system icon + reduced padding). Door 1 Groups field moves up under the plant identity (above Location). Say the word if you want either different.

> **Where we are / what's next:** Plan is written + audited (Passes 1–4) and ready for your review; I need your call on Decision 1 (the blocker) — and ideally 2 — before I touch code, then I build on a branch and report SHA + results for your greenlight.
