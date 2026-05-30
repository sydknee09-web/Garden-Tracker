# Plan — Care tab design (Phase C pre-scope)

**Status:** Sprint 2 design pass. READ-ONLY plan doc. NO code changes. Preps Phase C implementation chunk.
**Branch:** `ship/r1-6-migration-collision-guard-v2` (parent chat); Phase C will spawn its own branch when implementation starts.
**Origin/main sync:** n/a — doc-only chat.

**2026-05-29 correction:** §1.3 Gap J / §7.7 Chunk C7 / Section 8 Q6 amended — `household_tasks_select` RLS already shipped via `supabase/migrations/20250302000000_household_rpc_and_emails.sql:85-88`. Phase C Chunk C1 (`76bf36c`) verified this; the gap-J premise ("tasks lacks household peer-read") was wrong, so the C7 optional chunk and the Q6 ratification question are both moot. Substrate already covers shared-task visibility.

**Anchor docs:**
- [.claude/plans/gt_v1_scope.md](gt_v1_scope.md) (MUST #3 — Care tab is the v1-blocking Phase C of the plant-instance redesign)
- [.claude/plans/task_system_audit.md](task_system_audit.md) (existing substrate inventory)
- [.claude/plans/plant_instance_phase_a_followup_unarchive.md](plant_instance_phase_a_followup_unarchive.md) (Phase A status-foundation context)
- [VISION.md §6 Theme 2](../../docs/VISION.md) — "plant profile shallow for growing" failure mode this closes
- [VISION.md §8](../../docs/VISION.md) — locked design conventions (casing, em-dash, emerald split, chrome icon style, framing, sort)
- [CLAUDE.md](../../CLAUDE.md) — process + Chat Lifecycle + Plan-audit rules
- [PERSONAS.md](../../docs/PERSONAS.md) — Maya / Sydney / Walter / Aria / Sam persona walks
- [supabase/migrations/20250211000000_phase1_schema_foundation.sql](../../supabase/migrations/20250211000000_phase1_schema_foundation.sql) — `care_schedules` base table
- [supabase/migrations/20250303000000_care_schedules_end_date_and_soft_delete.sql](../../supabase/migrations/20250303000000_care_schedules_end_date_and_soft_delete.sql) — `end_date` + `deleted_at`
- [supabase/migrations/20250307000000_care_schedules_household_select.sql](../../supabase/migrations/20250307000000_care_schedules_household_select.sql) — household peer-read
- [supabase/migrations/20250310000000_care_schedules_grow_instance_ids.sql](../../supabase/migrations/20250310000000_care_schedules_grow_instance_ids.sql) — multi-instance scoping
- [supabase/migrations/20250311000000_supply_profiles_and_links.sql](../../supabase/migrations/20250311000000_supply_profiles_and_links.sql) — `supply_profile_id` links across care/tasks/journal/shopping
- [supabase/migrations/20250316000000_care_schedule_suggestions.sql](../../supabase/migrations/20250316000000_care_schedule_suggestions.sql) — AI suggestions table
- [src/lib/generateCareTasks.ts](../../src/lib/generateCareTasks.ts) — recurrence materializer + `copyCareTemplatesToInstance` + `advanceCareSchedule` + `getEffectiveInstanceIds`
- [src/components/CareScheduleManager.tsx](../../src/components/CareScheduleManager.tsx) — existing add/edit/delete UI
- [src/components/SupplyPicker.tsx](../../src/components/SupplyPicker.tsx) — existing supply chip-picker (multi-select)
- [src/app/vault/[id]/VaultProfileCareTab.tsx](../../src/app/vault/[id]/VaultProfileCareTab.tsx) — current profile-level Care tab
- [src/components/GrowInstanceModal.tsx:54](../../src/components/GrowInstanceModal.tsx) — current 2-tab modal (`overview | history`); Care tab is the addition

---

## Purpose

Phase C of the plant-instance redesign per [gt_v1_scope.md §2.1 MUST #3](gt_v1_scope.md). Lock the data model + inheritance semantics + UI shape + Phase C implementation chunks for the Care tab BEFORE code lands. The Care tab is L-sized and the highest-friction surface in Syd's dogfood; planning it in isolation (this chat) lets the implementation chunks ship cleanly without mid-build scope drift.

This doc answers four questions Phase C must have settled before code: (1) does the existing schema suffice or do we need additions? (2) how does instance care inherit from profile defaults — copy-on-plant or live-reference? (3) what does the cascade confirmation popup ask and when does it fire? (4) does the instance Care surface live in the modal, a new route, or both?

---

## In-scope / Out-of-scope (counter-creep guard)

**In-scope (this design pass):**
- Audit + document existing `care_schedules` schema + adjacent tables / cascade helpers
- Lock inheritance + override semantics (cascade direction; what edits propagate; what's confirmed)
- Define cascade confirmation popup behavior (when fires, what it asks, what happens on Yes / No)
- Lock UI shape on BOTH surfaces: profile-level Care tab (already exists; needs polish) + instance-level Care surface (NEW; today's `GrowInstanceModal` has 2 tabs, no Care)
- Lock route structure (recommendation: keep modal-based instance + extend profile Care tab; defer dedicated `/care/` aggregator)
- Lock task-scheduling integration semantics (catch-up, skip-today, supply propagation)
- Lock supply picker UI pattern (reuse `SupplyPicker.tsx` or stay with inline `<select>`)
- Break Phase C ship into commit-level chunks with effort estimates + sequencing
- Surface every open vision/persona fork for Syd ratification (Section 8)

**Out-of-scope (NOT this pass; deferred / parked):**
- Any code change (this is a plan-only chat per kickoff)
- Any migration drafting / SQL writing (recommendations only)
- The Care tab on plant profile for *legacy imports* (already gated out via `isLegacy` in [VaultProfileCareTab.tsx:114](../../src/app/vault/[id]/VaultProfileCareTab.tsx:114) — preserve as-is)
- AI suggestion-flow redesign (`CareSuggestions` works today; out of scope unless dogfood surfaces a friction)
- Dedicated `/care/` top-level route (cross-profile aggregated dashboard) — Calendar + Home already aggregate; defer as v1.x unless dogfood demands
- Weather-aware care notifications (CAN #25 in gt_v1_scope; depends on Care tab landing first; NOT v1)
- Phase 2.5 zone-aware library cache (CAN #22 in gt_v1_scope; cost-scaling, not v1)
- Calendar widget redesign (CAN #24 in gt_v1_scope)
- Push notification infrastructure (post-v1; weather-aware care depends on this)
- Task category CHECK widening to add `water` / `pesticide` as first-class TASK categories — surfaced as Section 8 Q for Syd; recommended deferred to v1.x polish unless she wants chip-color differentiation in v1

**Success criteria (for THIS chat):**
- [ ] Plan doc covers Sections 1-8 with grounded recommendations citing existing patterns (every design call has an anchor path or a Section 8 Q)
- [ ] Phase C implementation broken into 3-5 chunks with effort estimates + dependency sequencing
- [ ] Open questions for Syd captured as plain-English asks in Section 8 with `(Recommended)` markers per Rule C
- [ ] No code changes shipped from this chat
- [ ] Recommendation on schema additions: lock either "existing schema sufficient" OR enumerate additive migration scope (additive-only — per CLAUDE.md SQL migration rules, destructive is always-ask)

---

## Section 1 — Data model

### 1.1 What exists today (mapped from migrations + types)

**`care_schedules`** ([Phase 1 base table](../../supabase/migrations/20250211000000_phase1_schema_foundation.sql:33) + later migrations):

| Field | Type | Set by base / later | Role in Care tab |
|---|---|---|---|
| `id` | uuid PK | base | row id |
| `plant_profile_id` | uuid FK → plant_profiles ON DELETE CASCADE | base | profile binding |
| `grow_instance_id` | uuid FK → grow_instances ON DELETE CASCADE | base | single-instance binding (legacy single FK) |
| `grow_instance_ids` | uuid[] | [0310 migration](../../supabase/migrations/20250310000000_care_schedules_grow_instance_ids.sql) | multi-instance binding; null = all, [a,b] = subset |
| `user_id` | uuid FK → auth.users NOT NULL | base | owner |
| `title` | text NOT NULL | base | e.g. "Fertilize with 10-10-10" |
| `category` | text DEFAULT 'maintenance' | base | broad vocab (water/fertilize/prune/spray/repot/harvest/mulch/other) |
| `recurrence_type` | text CHECK | base | `interval / monthly / yearly / custom_dates / one_off` |
| `interval_days` | int | base | for `interval` (every N days) |
| `months` | int[] | base | for `yearly` |
| `day_of_month` | int | base | for `monthly` / `yearly` |
| `custom_dates` | date[] | base | for `custom_dates` (NOT exposed in UI today) |
| `next_due_date` | date | base | precomputed next |
| `last_completed_at` | timestamptz | base | last completion timestamp |
| `is_active` | bool DEFAULT true | base | hard off-switch (deactivation, not soft-delete) |
| `is_template` | bool DEFAULT false | base | **cascade marker** — true = profile-level template, copied on Plant |
| `supply_profile_id` | uuid FK → supply_profiles ON DELETE SET NULL | [0311 migration](../../supabase/migrations/20250311000000_supply_profiles_and_links.sql:40) | Shed product link |
| `end_date` | date | [0303 migration](../../supabase/migrations/20250303000000_care_schedules_end_date_and_soft_delete.sql) | optional schedule sunset |
| `deleted_at` | timestamptz | [0303 migration](../../supabase/migrations/20250303000000_care_schedules_end_date_and_soft_delete.sql) | soft delete |
| `notes` | text | base | freeform |
| `created_at` / `updated_at` | timestamptz | base | audit |

**RLS:** owner full-access (`auth.uid() = user_id`) + household peer-read (`household_care_schedules_select` policy in [0307 migration](../../supabase/migrations/20250307000000_care_schedules_household_select.sql:7) using `my_household_member_user_ids()` helper).

**Index:** `idx_care_schedules_active` on `(user_id, is_active, next_due_date) WHERE deleted_at IS NULL` ([0303 migration](../../supabase/migrations/20250303000000_care_schedules_end_date_and_soft_delete.sql:16)).

**`care_schedule_suggestions`** ([0316 migration](../../supabase/migrations/20250316000000_care_schedule_suggestions.sql)): AI-recommended schedules; user approves → migrates to `care_schedules`. Out of scope for inheritance design but kept as part of the substrate.

**`tasks.care_schedule_id`** FK → care_schedules ON DELETE SET NULL ([Phase 1 §1g](../../supabase/migrations/20250211000000_phase1_schema_foundation.sql:163)) — generated tasks reference their parent schedule for de-dup + completion advance.

**`tasks.category`** CHECK ([20250204200000_tasks_title_and_quick_categories.sql:10](../../supabase/migrations/20250204200000_tasks_title_and_quick_categories.sql:10)): **narrow vocab** — `sow / harvest / start_seed / transplant / direct_sow / maintenance / fertilize / prune / general`. `water`, `spray`, `repot`, `mulch` collapse to `maintenance` at materialization time ([generateCareTasks.ts:24](../../src/lib/generateCareTasks.ts:24)). **Information loss** — chip color / icon / filter on Calendar can't distinguish water from spray from mulch today.

**`tasks.supply_profile_id`** FK → supply_profiles ON DELETE SET NULL ([0311 migration](../../supabase/migrations/20250311000000_supply_profiles_and_links.sql:43)): inherited from generating schedule via [generateCareTasks.ts:225,267,283](../../src/lib/generateCareTasks.ts:225) — task remembers which Shed product the schedule pointed to.

### 1.2 Cascade behavior today (existing — NOT new)

The cascade is **COPY-ON-PLANT**, not live reference:

1. User creates a `care_schedule` with `is_template=true` + `plant_profile_id` set + `grow_instance_id` null. This is a "profile-level template."
2. When user plants the variety (creates a `grow_instance`), `copyCareTemplatesToInstance()` ([generateCareTasks.ts:386](../../src/lib/generateCareTasks.ts:386)) runs:
   - Reads every template for that profile (`is_template=true, is_active=true, deleted_at IS NULL`)
   - INSERTs a new `care_schedule` row per template, with `is_template=false`, `grow_instance_id` set to the new instance, `next_due_date` computed from sow_date + recurrence type
   - Copies: title, category, recurrence_type, interval_days, months, day_of_month, custom_dates, notes
   - DOES NOT copy: supply_profile_id, end_date (current gap — see §1.3)
3. After the copy, the instance-scoped schedule is its own independent row. Edits to the template do NOT propagate to existing instances. Edits to the instance-copy do NOT propagate back to the template.

**Permanent plants** (trees, perennials) per `profile_type='permanent'` ([Phase 1 §1c](../../supabase/migrations/20250211000000_phase1_schema_foundation.sql:67)) skip the copy step. Templates stay as `is_template=true, grow_instance_id=null` and `generateCareTasks` materializes tasks directly from the template (see [generateCareTasks.ts:83-105](../../src/lib/generateCareTasks.ts:83) — the "templateProfileIds → permanentProfileIds" branch). Multi-instance scoping via `grow_instance_ids` array.

### 1.3 Identified gaps for the Care tab

These are gaps in the substrate; design decisions on how to close them are in §2-§7.

**Gap A — Retroactive cascade.** If a user creates a profile template AFTER planting an instance, the existing instance does NOT receive the new schedule. There's no "apply to existing instances" prompt or background propagation. Phase C must add this; today the workaround is "manually add the same schedule per instance."

**Gap B — Edit-time cascade.** If a user edits a profile template (changes interval from 14 to 7 days), the existing instance copies keep the OLD interval. No prompt, no propagation. Phase C must add a "apply this edit to existing instances?" confirmation.

**Gap C — Override visibility.** Today an instance-copy looks identical to a freshly-created instance-only schedule. There's no "inherited from template" badge or "overridden" indicator. UI can't distinguish "this came from the profile default" from "this is an instance-only addition" from "this was inherited then locally edited."

**Gap D — `supply_profile_id` not copied at Plant.** [generateCareTasks.ts:404-455](../../src/lib/generateCareTasks.ts:404) inserts the new row without `supply_profile_id`. Templates that reference a Shed product (e.g., "Fertilize with 10-10-10 — Espoma Plant-tone") lose the product link on copy. **Strict bug.** Confirmed by reading the insert block — fields list is title/category/recurrence_type/interval_days/months/day_of_month/custom_dates/next_due_date/is_active/is_template/notes; `supply_profile_id` absent. Phase C must fix this regardless of other scope.

**Gap E — `end_date` not copied at Plant.** Same insert block as Gap D. Templates with end_date lose it on copy. Strict bug; Phase C must fix.

**Gap F — No `source_template_id` lineage.** Once copied, the instance-copy has no FK back to the template that spawned it. So even if Phase C wanted to show "inherited from profile," there's no row-level link to follow. Phase C needs a `source_template_id` column on `care_schedules` (additive, nullable).

**Gap G — No "is overridden" flag.** When user edits an instance-copy after inheritance, the system can't tell "this is still in sync with the template" from "this has diverged." Phase C may need an `is_override` boolean OR can compute it on-the-fly by diffing against the source template (preferred — avoids stale flag).

**Gap H — `tasks.category` narrow vocab.** Schedule categories `water / spray / repot / mulch` collapse to `maintenance` ([generateCareTasks.ts:24](../../src/lib/generateCareTasks.ts:24)). Surfaces as undifferentiated Calendar chip color + same icon. For v1 dogfood scale this is acceptable; for Aria-persona (houseplant) "watering" is the dominant care signal and visually merging it with mulch reads as a polish miss. Section 8 question for Syd.

**Gap I — No `tasks.updated_at`.** Edit timestamps not tracked on `tasks` — minor; not blocking Care tab.

**Gap J — ~~No `tasks` household-share RLS~~ CLOSED 2026-05-29.** Gap-J premise was wrong; `household_tasks_select` RLS already exists from `supabase/migrations/20250302000000_household_rpc_and_emails.sql:85-88` (verified Phase C Chunk C1 `76bf36c`). Household members already see each other's tasks for shared-visibility "Mom watered the rose bush yesterday." No action needed pre-C1. Section 8 Q6 also moot (see amendment stamp at top of doc).

**Gap K — `custom_dates` recurrence not in UI.** DB CHECK allows it; `CareScheduleManager.RECURRENCE_TYPES` ([CareScheduleManager.tsx:12-17](../../src/components/CareScheduleManager.tsx:12)) doesn't expose it. Niche use case; recommend keeping deferred unless Section 8 Syd asks for it.

### 1.4 Schema-change recommendation

**Substrate is ~90% sufficient.** Phase C needs ONE additive migration:

```sql
-- Phase C migration sketch (NOT for execution; spec only)
ALTER TABLE care_schedules
  ADD COLUMN IF NOT EXISTS source_template_id uuid REFERENCES care_schedules ON DELETE SET NULL;

COMMENT ON COLUMN care_schedules.source_template_id IS
  'For instance-copies: the profile template this row was copied from. NULL = instance-only or template itself. Enables inherit/override UI + edit-time cascade prompts.';

CREATE INDEX IF NOT EXISTS idx_care_schedules_source_template
  ON care_schedules (source_template_id) WHERE source_template_id IS NOT NULL AND deleted_at IS NULL;
```

**Why additive-only:**
- `ADD COLUMN IF NOT EXISTS` is idempotent + safe per CLAUDE.md SQL tier (code-tier; needs "yes build" greenlight at push time, not always-ask)
- No constraint changes on existing rows
- Existing rows get `source_template_id = NULL`, which correctly represents "instance-only or template itself" — backwards-compatible default

**Optional but recommended additions (defer if Syd wants to ship minimum):**

```sql
-- Optional: widens tasks.category to first-class water/spray/repot/mulch chips.
-- Skip if Syd is OK with maintenance-collapse for v1 dogfood (Section 8 Q5).
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_category_check
  CHECK (category IN ('sow','harvest','start_seed','transplant','direct_sow',
                       'maintenance','fertilize','prune','general',
                       'water','spray','repot','mulch'));

-- Optional: household peer-read on tasks (parallel to care_schedules 0307 policy).
-- Skip if Syd wants tasks to remain owner-only for v1 (Section 8 Q6).
CREATE POLICY "household_tasks_select" ON public.tasks
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));
```

**NOT recommended — `is_override` boolean column.** Better to compute on-the-fly by diffing the instance-copy's fields against `source_template_id`'s fields at render time. Reasons:
- Avoids stale flag (user edits template, flag would need updating across all copies)
- Trivial compute cost (single JOIN at fetch time)
- Sidesteps the "what counts as an override" question (any field change? notes only?)

**NOT recommended — separate `care_inheritance` join table.** The cascade is one-to-many (one template, many copies) which fits a single FK column. A join table would add JOIN cost without behavior gain.

### 1.5 What stays unchanged

- `getEffectiveInstanceIds()` resolver — keep as-is; handles instance subset scoping correctly
- `copyCareTemplatesToInstance()` — Phase C edits this function to (a) copy `supply_profile_id` + `end_date` (Gaps D + E) and (b) set `source_template_id = template.id` (Gap F). Function signature stays the same.
- `advanceCareSchedule()` — keep as-is; recurrence advance logic is correct and reused by completion side-effect.
- `generateCareTasks()` — keep as-is; the materialization + dedup logic is sound. Phase C may extend the `taskCategoryFromSchedule()` collapse rule if Syd ratifies the `tasks.category` widening (Section 8 Q5).
- `CareScheduleManager.tsx` — Phase C extends rather than rewrites; adds inheritance badge + cascade-confirm popup hookup.
- `VaultProfileCareTab.tsx` — keep as-is; Phase C just adds inheritance-aware rendering inside the wrapped `CareScheduleManager`.
- Household RLS on care_schedules — unchanged; the existing peer-read policy already handles the family-view path.

---

## Section 2 — Inheritance + override semantics

### 2.1 The CSS-cascade analogy locked

The kickoff brief frames the model as "CSS cascade." Translated literally:

- **Profile defaults = the base layer.** Every instance starts inheriting these.
- **Instance overrides = the override layer.** An instance can REPLACE an inherited rule (edit it locally) or ADD an instance-only rule (no template ancestor).
- **No re-inheritance.** Once an instance has overridden a rule, edits to the template do NOT silently overwrite the override. (CSS: once you `!important` a property, the cascade respects that.)
- **Deletion semantics — gated.** Deleting a profile-level template prompts the user about its instance-copies, but does NOT silently delete them (see §2.5).

This maps cleanly to the existing COPY-on-PLANT pattern + the proposed `source_template_id` lineage column. The cascade is **eager-snapshot** (copied at plant time + cascade prompt at template edit time), not **lazy-merge** (recomputed on every render). Eager-snapshot is the right choice for this app for three reasons:

1. **Matches the current implementation.** Switching to lazy-merge would rewrite `generateCareTasks` + `advanceCareSchedule` + every consumer that reads `care_schedules` directly. Eager-snapshot extends the existing code path; lazy-merge replaces it.
2. **Predictable user mental model.** "I added this schedule, now it's on my plant" is easier than "this schedule is inherited from a template that might change behind me." The latter requires a mental model of two layers; the former is one layer with explicit-action propagation.
3. **Cheaper.** No JOIN-at-render to resolve effective values. Instance reads stay simple table scans.

Trade-off accepted: edits to a template require an explicit cascade prompt (extra friction at template edit time) in exchange for never having a surprise rule change at the instance.

### 2.2 The four canonical actions + their cascade behavior

These are the four touch points where inheritance / override semantics matter. Phase C locks each one.

**Action 1 — Create profile-level template (with existing instances of the variety already planted).**

- User opens plant profile Care tab → Add Schedule.
- After Save → check: does this profile have any existing `grow_instances` with `status IN ('pending','growing','harvested')` AND `deleted_at IS NULL`?
- If YES (existing instances exist) → fire the **Cascade Confirm popup** (§2.4): *"Apply this new schedule to your N existing plants?"* with Yes / No buttons.
- If NO (no existing instances) → just save the template. No prompt. Future plantings will inherit it via `copyCareTemplatesToInstance()` at Plant time.
- **What "Yes" does:** server-side, INSERT one copy of the template per existing `grow_instance`, with `is_template=false, grow_instance_id=<instance>, source_template_id=<template>, next_due_date=today` (or computed from sow_date if the user prefers — see Section 8 Q3). Then run `generateCareTasks` to materialize the rolling task window.
- **What "No" does:** template saved as profile-level only. Existing instances remain unchanged. New plantings of this variety will receive the schedule.

**Action 2 — Create instance-level schedule (no template ancestor).**

- User opens GrowInstance Care tab (NEW per §3.2) → Add Schedule.
- Save → INSERT one row with `is_template=false, grow_instance_id=<instance>, source_template_id=NULL`.
- **No cascade prompt.** Instance-only schedules don't propagate to the profile or to sibling instances. (Per §2.1: cascade is one-directional from template to copies; instance-only never promotes back.)
- Future plantings of the same variety will NOT inherit this schedule. If the user wants this schedule on all future plantings too, they need to add it as a profile-level template separately. **This is a small friction point**; Section 8 Q2 surfaces a "promote to profile template?" affordance as an open question.

**Action 3 — Edit profile-level template (existing instance-copies already exist).**

- User edits an existing profile template (changes interval / category / recurrence).
- After Save → check: does this template have any `care_schedules` rows where `source_template_id = <template_id>` AND `deleted_at IS NULL` AND `is_template=false`? (i.e., instance-copies that descend from it)
- If YES → fire the **Cascade Confirm popup** (§2.4): *"Apply these changes to your N existing copies on planted instances?"*
  - Yes → UPDATE each instance-copy's edited fields to match the new template values. **Exception:** copies where the user has previously diverged ("locally edited") are surfaced with a count: *"N copies have been locally edited. Overwrite them too?"* sub-prompt. **Recommend: default = preserve local edits**; sub-prompt asks if user wants to force-overwrite. (Persona walk: Maya does multi-instance batch overrides she'd resent losing; Walter wouldn't realize an edit had been "local" — defaulting to preserve is the safer pick across both personas.)
  - No → template saved as profile-level only. Instance-copies keep their pre-edit values.
- **Detecting "locally edited."** Compute at prompt time by diffing the instance-copy's editable fields against the template's previous values. Editable fields = title, category, recurrence_type, interval_days, months, day_of_month, custom_dates, next_due_date, end_date, supply_profile_id, notes. If any field differs from template (pre-edit), copy is "locally edited."
- If NO instance-copies exist → no prompt. Just save the template edit.

**Action 4 — Edit instance-level schedule (instance-copy of a template OR instance-only).**

- User edits a schedule on a GrowInstance Care tab.
- After Save → INSERT/UPDATE in place. **No cascade prompt** — instance-level edits never propagate to template or siblings (per §2.1: one-directional cascade).
- If the row had `source_template_id` set, it STILL has it after the edit. The row is now "locally edited" relative to the template — surfaces in the UI as the "Overridden" badge (§3.3), and surfaces in Action 3's sub-prompt next time the template is edited.
- **No way to "re-sync" with the template.** If user wants to reset an override, they delete the instance-copy and the next template edit's cascade will recreate it. Section 8 Q4 surfaces "explicit Reset to template" as an open question; recommend deferring to v1.x unless dogfood demands it (low-frequency action; deletion+re-cascade is workable).

### 2.3 Deletion semantics

**Action 5 — Delete profile-level template (with existing instance-copies).**

- User clicks Delete on a profile template.
- Check: does this template have any instance-copies (`source_template_id = <id>, deleted_at IS NULL`)?
- If YES → fire **Delete Confirm popup** with explicit choice:
  - *"You have N copies of this schedule on planted instances. Delete:"*
    - **(A) Template only** — keeps instance-copies; clears their `source_template_id` to NULL (so they become standalone instance-only schedules).
    - **(B) Template and all copies** — soft-delete template + all instance-copies (sets `deleted_at` on all matching rows; cascades to `tasks` via existing `handleDelete` pattern in [CareScheduleManager.tsx:166](../../src/components/CareScheduleManager.tsx:166)).
    - **(C) Cancel** — no change.
  - **Recommend default highlight: (A) Template only** — non-destructive; matches the "first-time-user safe" principle. Maya / Walter / Aria personas all prefer preserve-instance-data over silent-loss.
- If NO instance-copies exist → simple confirm dialog (current pattern; no choice needed): *"Delete this schedule?"* Yes / Cancel.

**Action 6 — Delete instance-level schedule.**

- User clicks Delete on an instance schedule.
- Simple confirm dialog: *"Delete this schedule?"* Yes / Cancel.
- On Yes → soft-delete the instance-copy only (cascade to its generated `tasks` via existing pattern). Template unaffected. Sibling instances unaffected.

### 2.4 The Cascade Confirm popup — locked spec

Single popup shape used by Actions 1 + 3. Matches the existing FAB-form submit saga tokens + the Archive confirm precedent at [GrowInstanceModal.tsx:1062-1090](../../src/components/GrowInstanceModal.tsx:1062). Cite-by-path: tokens are `border-teal-gus/40` on Cancel + `bg-emerald-600 hover:bg-emerald-700` on Confirm — these are the canonical FAB-form submit tokens locked 2026-05-26 (per CLAUDE.md §"Emerald primary-emphasis token convention").

**Anatomy (left to right / top to bottom):**

1. **Heading (Title Case per VISION §8):** *"Apply to Existing Plants?"* (Action 1 — new template with siblings) or *"Apply Changes to Existing Copies?"* (Action 3 — template edit with siblings)
2. **Body (sentence case per VISION §8):**
   - Action 1: *"You have {N} planted {plant/plants} of this variety. Want to add this schedule to {them/it} too?"*
   - Action 3: *"You have {N} planted {plant/plants} with copies of this schedule. Update {them/it} to match the new settings?"*
   - Pluralization handled inline; `{N}` is a count badge styled as the heading number.
3. **Sub-line (only fires when N locally-edited copies exist on Action 3):** *"{M} of these were locally edited. Overwrite local edits too?"* with a checkbox (default OFF) labeled `Overwrite locally edited copies` — surfaces as the "force" path.
4. **Action buttons (flex-row, FAB-form submit saga tokens):**
   - Left: `Cancel` (`border-teal-gus/40 text-teal-gus`) — closes popup; template edit is reverted (Action 3) or saved as profile-only (Action 1, recommend "save template, don't apply" framing).
   - **Wait — clarification.** Cancel-from-cascade-prompt is ambiguous: does it cancel the save entirely, or save the change but not propagate? Lock the semantics: **Cancel = save the template change at profile level, but don't propagate to instances.** Reasons: (a) the save is already complete by the time the popup fires (Action 1/3 happen post-save); (b) "cancel propagation" is the natural reading per the popup body's "Apply to existing?" framing; (c) matches Material Design / iOS pattern of "Cancel = don't do the optional action."
   - Right: `Apply to {N} plants` (`bg-emerald-600 hover:bg-emerald-700 text-white`) — fires the cascade.
5. **Loading state:** Apply button shows the canonical spinner SVG (`w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin`) while the bulk UPDATE / INSERT runs. Disable on click; re-enable on error.
6. **Error feedback:** On failure, popup stays open with red error banner (`text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2`). Existing `formatAddFlowError` pattern at [CareScheduleManager.tsx:155](../../src/components/CareScheduleManager.tsx:155) handles the message.
7. **Success feedback:** Popup closes + toast: *"Applied to {N} plants"* (Action 1) / *"Updated {N} copies"* (Action 3). Toast color = emerald per cohesion-by-aggregation; pattern anchor: existing toast usage in `GrowInstanceModal.handleArchive` at [GrowInstanceModal.tsx:445](../../src/components/GrowInstanceModal.tsx:445).

**Z-stack:** `z-[100]` overlay + `z-[101]` panel — matches Archive precedent for stacking inside the GrowInstanceModal.

**Mobile-portrait shape:** `fixed left-4 right-4 bottom-4 rounded-2xl shadow-xl p-5 mx-auto max-w-sm` — same as Archive precedent. Walter persona: 44×44 tap targets on both buttons via `min-h-[44px]`; sub-line checkbox 44×44 hit area.

### 2.5 Sibling-edge: skip non-applicable instances during cascade

When Action 1 (new template + cascade-Yes) or Action 3 (edit template + cascade-Yes) propagates to instance-copies, **skip these instance states**:

- `status = 'archived'` — instance is no longer growing; cascading a care schedule to it pollutes the orphan-cleanup logic in [generateCareTasks.ts:163-190](../../src/lib/generateCareTasks.ts:163).
- `status = 'dead'` — instance is dead; no future care relevant.
- `deleted_at IS NOT NULL` — soft-deleted; treat as not present.
- For Action 3: instances where the user has previously deleted their copy of the schedule (no `source_template_id = <id>` row remaining). Re-creating after explicit delete violates user intent.

The popup's `{N}` count should reflect ONLY applicable instances (status IN pending/growing/harvested, not soft-deleted, has an existing copy for Action 3 / doesn't have one yet for Action 1). Persona walk: Maya batches; Maya does not want a multi-bed schedule that includes 3 archived rows from a past season.

### 2.6 Edge cases worth naming

- **Multi-instance template cascade (permanent plants).** When a permanent plant has 5 instance plantings and the template uses `grow_instance_ids = [a,b]`, the cascade applies only to instances `a` and `b`. Existing `getEffectiveInstanceIds` resolver handles this naturally; no special-case logic needed.
- **Cascade during plant flow.** Action 1's cascade prompt fires AFTER a template create that has existing instances. The Plant flow itself (creating a new grow_instance + `copyCareTemplatesToInstance`) is NOT considered a cascade — it's the initial copy. No prompt at Plant time.
- **User cancels the Cascade Confirm popup, then opens it again.** Once Cancel fires, the template is saved at profile level and the cascade prompt does NOT re-fire on subsequent renders. If user wants to retroactively cascade later, they need an explicit "Apply to all existing plants" action button on the template card (§3.4 surface).
- **Concurrent edits.** Two household members both editing the same template — last-write-wins on the template row (existing behavior). Last-write-wins applies on the cascade too. Not designing for finer-grained concurrency in v1.

---

## Section 3 — UI shape

### 3.1 Profile-level Care tab (existing surface — extended)

**Location:** [src/app/vault/[id]/VaultProfileCareTab.tsx](../../src/app/vault/[id]/VaultProfileCareTab.tsx) — already exists; rendered when user opens a plant profile (Vault tab → profile card → Care sub-tab).

**Today the surface has:**
- AI suggestions card (`CareSuggestions` component) — keep as-is.
- `CareScheduleManager` add/edit/delete UI — keep, extend with cascade-confirm popup.
- "Historical tasks" collapsed section — keep as-is (out of scope for Phase C).
- Legacy-imports gate-out — keep as-is.

**Phase C extensions (additive only — no removals):**

1. **Inheritance-context banner** at the top of the schedule list, before the first card. Sentence-case body copy per VISION §8:
   - For seed profiles: *"These schedules apply to new plantings of this variety. Edits prompt you to update existing plants."* Single sentence; no link.
   - For permanent profiles: *"These schedules apply to all plantings of this plant. Edit any to change them everywhere, or override per-plant from a plant's Care tab."*
2. **Source-template indicator on schedule cards** — n/a for profile-level (every card on profile Care tab IS a template). No badge needed here; badge surfaces on the instance Care tab (§3.3).
3. **"Apply to existing plants" affordance** on each template card — small action link in the card footer, sentence case (action verb): *"Apply to {N} existing plants"* with click → fires the Cascade Confirm popup retroactively. Anchored to per-row affordance pattern at [VaultProfileCareTab.tsx historical section variety links](../../src/app/vault/[id]/VaultProfileCareTab.tsx:99) — text-link emerald-600 style. Only renders when N ≥ 1 instances exist AND none of them have an instance-copy yet (otherwise the action is no-op).

### 3.2 Instance-level Care tab (NEW surface)

**Location:** [src/components/GrowInstanceModal.tsx](../../src/components/GrowInstanceModal.tsx) — today has 2 tabs (`overview | history` per [line 54](../../src/components/GrowInstanceModal.tsx:54)). Phase C adds a third: `care`. Final tab order: `overview | care | history`. Care positioned middle because it's the highest-frequency interaction.

**Why modal-based, not a new route:**
- The plant-instance entry point is already the modal (opened from Active Garden / My Plants / Calendar / dashboard). Adding a dedicated `/instance/[id]/care` route would require parallel implementation of all instance state already living in the modal.
- A route-based instance page is its own ship (deferred per Section 4) and Care tab can land cleanly in the modal first.
- Modal already has tab infrastructure (`activeTab` state, tab button row at [GrowInstanceModal.tsx:766](../../src/components/GrowInstanceModal.tsx:766)). Extending it is cheaper than building new.

**Tab structure:**

```
┌─ Overview ──┬─ Care ───┬─ History ─┐
│ growth photo│          │           │
│ pill summary│          │           │
│ etc.        │          │           │
└─────────────┴──────────┴───────────┘
```

**Care tab content shape (top to bottom):**

1. **Inheritance-context line** at top, single sentence, sentence case, neutral-600 color:
   - *"Your care schedule for this plant. Inherited from the {Tomato} profile."* (plant profile name in default neutral, not link — tap on profile name navigates back to profile per anchor pattern at [VaultProfileCareTab.tsx:99](../../src/app/vault/[id]/VaultProfileCareTab.tsx:99) — actually the variety-name-link pattern at vault history; rec is plain text for instance, navigate via Overview's existing profile link).
2. **Empty state** if no schedules exist for this instance: 3-part frame per VISION §8:
   - Title (Title Case): "No care schedules yet"
   - Body (sentence case): "Add a reminder like water, fertilize, or prune."
   - Verb-led CTA: button labeled "Add Schedule" (Title Case per button rule).
3. **Schedule list** = list of cards, one per instance-scoped `care_schedules` row where `grow_instance_id = <this instance>` OR `grow_instance_ids` contains this instance, AND `deleted_at IS NULL`.
4. **Add button** (when list is non-empty): same pattern as `CareScheduleManager` line 242 — small emerald-600 pill labeled `+ Add`, top-right above the list.

### 3.3 Schedule card shape on the instance Care tab

Reuse the existing card primitive from [CareScheduleManager.tsx:248-285](../../src/components/CareScheduleManager.tsx:248) — `bg-white rounded-xl border border-neutral-100 p-4 shadow-sm`. **Extend** with inheritance badge in the right-edge of the card header:

```
┌──────────────────────────────────────────┐
│ 🌿  Fertilize with 10-10-10    [Inherited]│
│     Every 14 days                         │
│     Next: Jun 12, 2026                    │
│     Product: Espoma Plant-tone (Espoma)   │
└──────────────────────────────────────────┘
```

**Inheritance badge variants** (right-edge of card header, small pill, follows chrome-icon flat-style per VISION §8):

| Badge label | When shown | Color tokens | Why |
|---|---|---|---|
| `Inherited` | `source_template_id IS NOT NULL` AND no fields diverge from template | `bg-neutral-100 text-neutral-600 border border-neutral-200` | Neutral — informational only |
| `Overridden` | `source_template_id IS NOT NULL` AND one or more fields diverge from template | `bg-amber-50 text-amber-700 border border-amber-200` | Amber — signal "diverged from default" |
| (no badge) | `source_template_id IS NULL` (instance-only) | n/a | Default = no signal needed; this IS the user's choice |

**Color choice rationale (cohesion-by-aggregation check):**
- Amber for "Overridden" is NEW pattern. No existing app-wide "diverged-from-source" badge to anchor against. Closest sibling: `bg-emerald-100 text-emerald-800 border border-emerald-300` used for selected month-pills in [CareScheduleManager.tsx:347](../../src/components/CareScheduleManager.tsx:347). Emerald reads as "selected/positive" which would mis-signal "overridden = positive." Amber gives the "you changed this on purpose; we're telling you so" signal without alarm. **Surface as Section 8 Q7 for Syd: amber vs neutral-with-italic-label vs something else.** Recommend amber.
- Neutral for "Inherited" is anchored to existing neutral-100/600 styling on the recurrence-label row at [CareScheduleManager.tsx:253](../../src/components/CareScheduleManager.tsx:253). ✓ Cohesive.

**Tap-target compliance (Walter persona):** badge is purely informational, not tappable (no action on tap). So no 44×44 requirement. Tap on the whole card opens the edit form (existing pattern at [CareScheduleManager.tsx:271](../../src/components/CareScheduleManager.tsx:271) `openEdit`); the edit form is the surface where user can override.

### 3.4 Cross-surface render parity

The same `CareScheduleManager` component renders on BOTH:
- Profile-level Care tab (`is_template={true}` default — controls add new template behavior + cascade prompt on save)
- Instance-level Care tab (`is_template={false}` — controls add new instance-only schedule behavior)

Phase C extends the component's props with:
```ts
{
  isInstanceLevel?: boolean;     // NEW — true when rendering on instance Care tab
  growInstanceId?: string;       // NEW — required when isInstanceLevel=true
  onCascadeConfirm?: (template: CareSchedule, action: 'create'|'edit') => Promise<{N: number, localEditCount: number}>;  // NEW — fires the cascade-confirm popup; resolves with applied counts
}
```

**Anchor for prop extension shape:** existing `CareScheduleManager` props at [CareScheduleManager.tsx:20-37](../../src/components/CareScheduleManager.tsx:20) — adding `isInstanceLevel` + `growInstanceId` follows the same `?` optional + JSDoc-comment convention. ✓ Anchored.

### 3.5 Empty states (5-persona walk)

Per VISION §8 "Empty states" + the 3-part frame rule. Walking each instance-Care empty state:

- **No schedules + Inherited from profile that has templates.** This case shouldn't fire — copy-on-plant means instance starts with copies if the profile had templates. But if the user deletes all copies, surfaces as empty.
  - Title: "Care schedules cleared"
  - Body: "You deleted the schedules inherited from {Tomato}. Add a new one, or restore from the profile."
  - CTA: button `Add Schedule` + small text-link `Restore from {Tomato} profile` below.
- **No schedules + Profile has no templates.** Pure empty state.
  - Title: "No care schedules yet"
  - Body: "Add a reminder like water, fertilize, or prune."
  - CTA: `Add Schedule`.
- **Sam persona (first-time):** sees the empty state; copy is non-jargon (no "schedule cascade," no "template"). ✓
- **Aria persona (houseplant):** body copy "water, fertilize, or prune" applies to her use case. ✓ No outdoor-garden assumption.
- **Walter persona:** CTA labeled in plain language ("Add Schedule"), 44×44 tap target. ✓
- **Maya persona:** the "Restore from profile" link respects her multi-instance batch workflow — she can blow away all instance overrides and pull defaults back. ✓
- **Sydney (user):** explicit "Inherited from profile" framing matches the CSS-cascade analogy she's familiar with. ✓

### 3.6 Display convention compliance check

Walking each VISION §8 convention:

- **Casing.** Title Case on headers + buttons + section h2s; sentence case on body. Audit all proposed strings:
  - Tab label `Care` ✓
  - Banner heading on profile: *"These schedules apply to new plantings..."* — body sentence; no title. ✓
  - Card heading (schedule title) — user-entered; preserved as-is.
  - Add Schedule button: `Add Schedule` (Title Case) ✓
  - Empty-state title: `No care schedules yet` — **sentence case here is correct** because empty-state body framing per VISION §8 uses sentence case for the title-line of the 3-part frame (verb-led CTA gets Title Case). Wait — re-checking VISION §8: empty-state title IS Title Case per §8 "Empty states pass the 3-part frame. Title (Title Case)." **Lock correction:** title-line is `No Care Schedules Yet` (Title Case). Phase C must use this casing. (Cohesion check: existing empty state at [CareScheduleManager.tsx:226](../../src/components/CareScheduleManager.tsx:226) reads "No care schedules yet" — sentence case — pre-existing drift from convention; Phase C ships the correct version.)
  - Cascade popup heading: `Apply to Existing Plants?` (Title Case) ✓
  - Cascade popup body: *"You have {N} planted plants of this variety..."* (sentence case) ✓
  - Apply button: `Apply to {N} plants` (Title Case `Apply`, then count + lowercase `plants` since `plants` follows the count interpolation; check AP-style — "Apply" capitalized, "to" 2-letter preposition lowercase, "{N}" is a number, `plants` ends the phrase so per "first + last word ALWAYS capitalized" rule, `Plants` should be capitalized at the END.) **Final: `Apply to N Plants`** (Title Case proper). ✓
- **Empty-cell em dash.** No empty-cell rendering proposed in this design; n/a. Calendar Care entries will still use existing em-dash conventions where relevant.
- **Icon style.** Inheritance badges use no icon (label-only, small chrome pill); cascade-confirm popup uses no icon. Add Schedule button uses no icon (label-only). All chrome — flat-monotone-line style applies if any icon is added. ✓
- **Chrome control framing.** Tabs (`Overview | Care | History`) are toggle-style framed/unframed — match existing tab pattern at [GrowInstanceModal.tsx:767](../../src/components/GrowInstanceModal.tsx:767) which is border-bottom-2 active state. ✓ Anchored.
- **Emerald token split.** Apply button = CTA = `bg-emerald-600 hover:bg-emerald-700` ✓. Cancel = `border-teal-gus/40 text-teal-gus` (FAB-form Cancel token) ✓. Add Schedule button = CTA = `bg-emerald-600 hover:bg-emerald-700` ✓.
- **Default sort.** Care tab list = lookup surface (user navigating to a specific plant's care). Per VISION §8 sort framework: alphabetical OR by next-due-date. **Recommend: by `next_due_date` ASC, then alpha** — care surface is action-oriented ("what do I do next?") not name-oriented. Section 8 Q8 to confirm. Anchor: existing Calendar already sorts by date; cohesion preserved.

---

## Section 4 — Routes + navigation

### 4.1 Recommendation: keep modal-based for v1

**No new `/care/` route, no new `/instance/[id]/care` route in v1.** Care lives:

- **Profile-level Care:** existing surface at `vault/[id]/page.tsx` → Care sub-tab (rendered via `VaultProfileCareTab`). Extension only.
- **Instance-level Care:** NEW Care tab inside the existing `GrowInstanceModal`. No URL change; modal opens via existing entry points (Active Garden / My Plants / Calendar / dashboard).
- **Cross-instance aggregation:** stays on Calendar (already shows all upcoming care tasks across all plants) + Home/dashboard "today's care" section.

**Why no top-level `/care/` route:**

1. **Calendar + Home already aggregate.** A standalone `/care/` route would duplicate `today / this-week / overdue` views that already render at `/calendar` and `/`. Net new UX, marginal user value, M-sized scope. Per gt_v1_scope.md §2.3 / CAN bucket, top-level aggregated Care destination is post-v1 candidate not MUST.
2. **6-tab nav is locked.** Bottom nav has 6 tabs (Home / Garden / Plants / Vault / Calendar / Journal). Adding Care would require either bumping a tab OR adding a 7th, which violates IA Ship A locked decisions. Either route would be friction.
3. **Care belongs to its surface.** A schedule is per-plant. Browsing care globally is the same as browsing the Calendar. v1 keeps the model simple.

**Why no dedicated `/instance/[id]/care` route:**

1. **The instance UI is a modal.** GrowInstanceModal is the canonical surface for plant-instance details. Splitting Care to a separate route would fragment the user mental model. (Per Phase B redesign: instance page is the highest-friction surface; Phase B is the visual / layout overhaul, not the route restructure.)
2. **Tab infrastructure already exists.** Adding a third tab is mechanical (`ActiveTab = 'overview' | 'care' | 'history'`). A new route is a parallel implementation of all the modal's state management.
3. **Modal supports deep-linking.** Calendar deep-link to a specific schedule via `focusScheduleId` already works ([CareScheduleManager.tsx:88-95](../../src/components/CareScheduleManager.tsx:88)). The Care tab can extend this — a `?openInstance=<id>&tab=care&focusSchedule=<id>` URL pattern brings the user from Calendar back to the schedule inside the modal.

### 4.2 Navigation entry points after Phase C lands

| User intent | Entry point | URL pattern (no change from today, except Care tab is now default-open for some flows) |
|---|---|---|
| "Plan care defaults for a variety" | Vault → profile card → Care sub-tab | `/vault/{profileId}?tab=care` (existing) |
| "See / edit care for one specific plant" | Active Garden / My Plants → instance card → tap "Care" pill OR open modal → Care tab | `/garden` or `/my-plants` → modal opens with `?tab=care` (NEW deep-link param) |
| "What care is due today?" | Home dashboard "Today" section OR Calendar | existing routes |
| "Mark a care task complete" | Calendar OR Home → tap task → complete | existing routes |
| "Add care reminder for a specific plant" | Open modal → Care tab → +Add | NEW: care tab affordance inside modal |
| "Add care template for all plants of this variety" | Vault → profile → Care sub-tab → +Add | existing surface, extended with cascade prompt |

**No new bottom-nav entry.** No new top-level icon. No new URL.

### 4.3 Deep-link from Calendar to Care tab on the instance

When user taps a care task on Calendar:
- Today: opens the profile's Care tab via `vault/{profileId}?focusSchedule=<id>` ([VaultProfileCareTab.tsx:43-44](../../src/app/vault/[id]/VaultProfileCareTab.tsx:43)).
- Phase C: keep this behavior for profile-level templates. For instance-scoped schedules (task has `grow_instance_id` set), open the GrowInstanceModal with `?openInstance=<grow_instance_id>&tab=care&focusSchedule=<schedule_id>` — modal opens to Care tab, scrolls to the schedule card.

**Why useful:** today instance-scoped schedules from Calendar deep-link to the profile Care tab, which means user navigates back to the variety-level page instead of the plant-level page. Phase C fixes this — Calendar → tap care task on Plant A → opens Plant A's Care tab in the modal. Strict UX improvement, no decision needed.

### 4.4 Post-v1 escape hatch: dedicated `/care/` if dogfood demands

If post-launch Syd dogfood reveals a recurring "I want to see ALL my care tasks across all plants" need that Calendar + Home don't satisfy, a dedicated `/care/` route is a clean v1.1 add:
- Reuses `VaultProfileCareTab` aggregation logic generalized to cross-profile.
- New bottom-nav slot would require IA conversation; more likely sits as a Settings → "Care overview" entry, or as a Home dashboard "see all" link.
- Not v1-blocking. Section 8 Q9 surfaces this as an open question to confirm Syd's read.

---

## Section 5 — Task scheduling integration

### 5.1 Care schedules → tasks materialization (existing path; extend)

Today's flow ([generateCareTasks.ts:50](../../src/lib/generateCareTasks.ts:50)) materializes a rolling 30-day window of `tasks` rows from each active `care_schedule`. Phase C extends this without restructuring:

1. **Trigger points stay the same:** Home/dashboard load, Active Garden load, Care tab `onChanged` callback. Phase C adds: GrowInstanceModal Care tab `onChanged` callback. Single extra trigger; matches the existing `VaultProfileCareTab.handleCareChanged` pattern at [VaultProfileCareTab.tsx:45-48](../../src/app/vault/[id]/VaultProfileCareTab.tsx:45).
2. **Window stays 30 days** (`RECURRING_WINDOW_DAYS = 30`). No change.
3. **De-dup stays via `care_schedule_id` + `due_date`** ([generateCareTasks.ts:192-208](../../src/lib/generateCareTasks.ts:192)). No change.
4. **Materialization respects `is_active`, `deleted_at`, `end_date`.** No change.
5. **NEW:** When user clicks "Apply to existing plants" on a template create / edit, the bulk INSERT/UPDATE on instance-copies finishes BEFORE `generateCareTasks` is re-fired. This avoids a race where tasks materialize from a half-cascaded state. Sequence: cascade → `generateCareTasks(userId)` → Care tab `onChanged` → re-fetch UI.

### 5.2 Task completion → schedule advance (existing path; no change)

Today's `advanceCareSchedule()` ([generateCareTasks.ts:300](../../src/lib/generateCareTasks.ts:300)):
- Computes next `next_due_date` from recurrence type + interval / months / day_of_month
- Sets `last_completed_at` to now
- Sweeps + regenerates future tasks for that schedule
- For `one_off`: marks `is_active = false`

Phase C consumers (instance Care tab) trigger this via the existing completion path on Calendar / Home. **No change to `advanceCareSchedule` itself.**

### 5.3 Catch-up logic (existing path; document for Care tab UX)

When user is N weeks behind, today's behavior:
- Pending tasks with `due_date < today` show as **overdue** on Calendar and Home.
- `generateCareTasks` does NOT pre-populate new future tasks for a schedule while overdue tasks exist (per [generateCareTasks.ts:241-243](../../src/lib/generateCareTasks.ts:241)) — *"If there's any overdue pending task for this schedule, don't create new tasks. Leave the overdue task in the outstanding section until the user completes it."*
- Result: user sees a single overdue task per schedule, not 8 stacked-up "you missed last Tuesday too" tasks. This is the catch-up affordance.

**Phase C extends this on the Care tab UI:**
- On the instance Care tab schedule card, show a small "Overdue" indicator next to the next-due-date when `next_due_date < today` AND a pending overdue task exists.
- On tap → opens a "Catch up?" mini-affordance:
  - **Option A — "Mark today, advance schedule":** completes the overdue task NOW, advances `next_due_date` to today + interval. Fast path.
  - **Option B — "Mark as missed":** soft-deletes the overdue task without advancing; `next_due_date` re-computes to the next eligible date going forward. Used when user skipped intentionally.
- **Recommend default = Option A** (mark + advance) per persona walk: Sydney expects the "I'm catching up" framing; Maya wants to fast-track when she's been away.
- The affordance is small (no full modal); inline expander on the schedule card. Trade-off: adds UI density; balances against making catch-up obvious. **Section 8 Q10** surfaces inline expander vs. small confirm modal as an open question.

### 5.4 Skip-today logic (NEW for Care tab; existing for general tasks)

Today's Calendar / Home task surface allows "skip" by editing the task to a future date OR deleting it. There's no first-class "skip today" affordance.

**Phase C adds "skip today" on the instance Care tab schedule card AND on Calendar care tasks:**
- Swipe-or-tap action on a schedule's next-due task: "Skip → next occurrence advances."
- **Implementation:** soft-delete this specific task row; call `advanceCareSchedule` to compute the NEXT next-due-date past the skipped occurrence. `last_completed_at` is NOT updated (skip ≠ complete).
- Walter persona concern: swipe-only would exclude him. **Lock: skip is always exposed as a tap-affordance**, NOT swipe-only. Pattern: on the schedule card, show small "Skip" text-link next to "Next:" date row. Tap → confirm popup "Skip this occurrence?" Yes / Cancel. ✓ Tap-discoverable for Walter; doesn't crowd the card.

### 5.5 Supply propagation chain

Today's flow:
- `care_schedules.supply_profile_id` → `generateCareTasks` propagates → `tasks.supply_profile_id` ([generateCareTasks.ts:225,267,283](../../src/lib/generateCareTasks.ts:225)) ✓ works.
- When task is completed → `journal_entries` row created (per existing completion-side-effect flow). `journal_entries.supply_profile_id` column exists ([0311 migration](../../supabase/migrations/20250311000000_supply_profiles_and_links.sql:46)).

**Verify in Phase C audit:** does the existing task-completion → journal-entry pipeline copy `supply_profile_id` from task to journal? If not, that's a strict-bug to fix in Phase C — the supply usage history needs to be queryable from Shed product detail page. Pass-1 fact-check during Phase C plan.

### 5.6 Tasks tab on instance — do we add one?

Today GrowInstanceModal has `overview | history` tabs. Phase C adds `care`. **Open question (Section 8 Q11):** does Phase C also add a `tasks` tab (showing all generated + manual tasks for this instance, past + upcoming)?

**Recommend NO for v1.** Reasoning:
- Calendar already shows tasks per-instance (filter by plant).
- A dedicated tasks tab on the modal would duplicate Calendar without much added affordance.
- The `history` tab can grow to include task-completion history if dogfood demands; cheaper extension.

If Syd wants the dedicated tasks tab in v1, it's an additive chunk (~XS-S) — same `tasks` query pattern from Calendar, filtered to `grow_instance_id = <this>`. Listed as a Phase C add-on chunk if greenlit.

### 5.7 Catch-up tracker — interaction with `is_active`

The `is_active` flag on `care_schedules` is the hard off-switch. Phase C must NOT use `is_active = false` to mark "user has skipped today" — that would deactivate the entire schedule. Use the task-level soft-delete for skip-this-occurrence; use `is_active = false` only when user explicitly deactivates a schedule via the schedule's edit form (existing path).

---

## Section 6 — Supply picker UI

### 6.1 The two existing patterns in the codebase

Garden Tracker has **two supply-picker patterns** in production today:

**Pattern A — Inline `<select>` dropdown** ([CareScheduleManager.tsx:362-383](../../src/components/CareScheduleManager.tsx:362)):
- Single-select native `<select>` with `<option>` per supply
- Format: `{name} ({brand}) — {Category}`
- Compact; fits inline in a form
- No multi-select, no typeahead
- Used in: `CareScheduleManager` form

**Pattern B — Multi-select chip picker** ([SupplyPicker.tsx](../../src/components/SupplyPicker.tsx)):
- Wrapped-checkbox chips, multi-select, 44×44 tap targets
- Color-state on checked: `border-emerald-500 bg-emerald-50 text-emerald-800` (emerald-500 = STATE per VISION §8 emerald split)
- Format: `{name} ({brand}) — {Category}` (same display format)
- Used in: AddPlantModal "Supplies used (optional)" path, journal entry "Supplies" path

### 6.2 Phase C recommendation — keep Pattern A for care schedules

**Recommendation:** care schedules stick with Pattern A (inline single-select). Reasons:

1. **Semantic fit.** A care schedule represents ONE recurring action with ONE product (fertilize with Espoma, water with rainbarrel, spray with neem). Multi-select implies "this care task uses 3 products in sequence," which doesn't match the data model — `care_schedules.supply_profile_id` is a single FK, not array.
2. **Cohesion preserved.** Today's `CareScheduleManager` uses Pattern A; flipping to Pattern B mid-Phase-C would be a UI restructure for negative value.
3. **Walter persona.** Native `<select>` is the most discoverable, screen-reader-friendly, large-tap-target affordance for single-choice. Chip multi-select adds visual density without adding affordance for a single-choice scenario.

**Trade-off:** Pattern A doesn't have typeahead, which means if the user has 50 supplies, finding one is slower. Mitigations:
- Sort `supplies` by category, then alphabetical (already by name; could group by category as `<optgroup>` for ergonomics — XS extension).
- "Add new product" link below the `<select>` if supply isn't there (currently the empty-state copy at [CareScheduleManager.tsx:381-383](../../src/components/CareScheduleManager.tsx:381) reads *"Add products in the Shed to link them here."* — Phase C improves this with a deep-link button: **"+ Add to Shed"** which opens the Shed add flow in a sub-screen, returning the new supply pre-selected).

### 6.3 New supply add path from within picker

**Current state.** If the user opens the schedule form and doesn't see the supply they want, they have to:
1. Cancel the form
2. Navigate to Shed
3. Add the supply
4. Navigate back to the plant profile / instance
5. Re-open the Care tab
6. Re-open the schedule form
7. Select the new supply

**Phase C extension.** Add a small "+ Add to Shed" button below the supply `<select>`. On tap → opens an in-form mini-flow (no navigation away):

```
┌── New Care Schedule ─────────┐
│ Title: [Fertilize           ]│
│ Category: [Fertilize ▼]      │
│ ...                          │
│ Product: [None ▼]            │
│         [+ Add to Shed]      │  ← NEW
│ Notes: [                    ]│
└──────────────────────────────┘
```

On tap "+ Add to Shed" → modal-within-modal opens with a stripped-down Shed-add form (name, brand, category). Save → new `supply_profile` row → `<select>` refetches supplies → newly-added supply auto-selected. User keeps building the schedule.

**Why mini-flow vs full Shed-add modal:**
- Full Shed add flow (`AddSupplyModal` or equivalent) has more fields (purchase date, vendor, photo). Stripped-down version captures just the essentials.
- Maintaining sub-flow inside the schedule form preserves user's in-progress schedule state.
- Anchor pattern: existing AddPlantModal sub-flows for supply-attachment.

**If "+ Add to Shed" is M-sized scope** (touches Shed-add flow extraction), defer to a Phase C sub-chunk OR park to v1.1 polish. **Section 8 Q12** surfaces this question.

### 6.4 Display format alignment

Both Pattern A and Pattern B use the same display format today: `{name} ({brand}) — {Category}` with brand parenthesized when present. Phase C preserves this. ✓ Cohesion confirmed.

**Empty-state copy in supply dropdown when no supplies exist:**
- Today: *"Add products in the Shed to link them here."* (sentence case, hint-level text) ([CareScheduleManager.tsx:381-383](../../src/components/CareScheduleManager.tsx:381))
- Phase C: same copy but with the "+ Add to Shed" deep-link as the affordance.

### 6.5 Supply propagation across the schedule → task → journal chain

§5.5 already locked this; surfaces here for completeness:
- Schedule has supply_profile_id → tasks generated from schedule inherit it ([generateCareTasks.ts:225](../../src/lib/generateCareTasks.ts:225)) → task completion creates journal entry → journal entry should also inherit supply_profile_id.

**Verify in Phase C Pass-1 audit:** does the existing task → journal completion flow propagate supply_profile_id? If gap, fix in Phase C (additive; pure code change, no schema needed).

### 6.6 Persona walk on supply picker

- **Maya (power gardener):** has 30+ supplies; needs fast picking. Pattern A `<select>` with optgroup-by-category is the best compromise. ✓ if Phase C adds optgroups; ⚠ if not. Recommend XS optgroup extension.
- **Sydney (planner):** has 5-10 supplies; Pattern A is fine. ✓
- **Walter (retiree):** native `<select>` accessible, tap-friendly. ✓
- **Aria (houseplant):** 2-3 supplies likely; "+ Add to Shed" makes first-time supply add painless. ✓
- **Sam (first-time):** sees "None" option pre-selected; doesn't need to interact until first supply added. ✓ Empty state explains.

---

## Section 7 — Phase C implementation chunks

Breaking Phase C into commit-level chunks for sequencing. Each chunk has scope + effort + dependencies.

### 7.1 Chunk C1 — Schema migration + `copyCareTemplatesToInstance` fixes (XS-S)

**Scope:**
- Migration: ADD `care_schedules.source_template_id` (uuid FK, nullable) + index per §1.4.
- Code: extend `copyCareTemplatesToInstance` ([generateCareTasks.ts:386](../../src/lib/generateCareTasks.ts:386)) to copy `supply_profile_id` + `end_date` + set `source_template_id = template.id` on the copy.
- Strict-bug fixes (Gaps D + E in §1.3) — these ship with the migration since they all touch the copy flow.

**Effort:** XS-S (~1-2h). Pure additive migration + ~10 lines of TS change.

**Dependencies:** none. First chunk to land.

**Acceptance criteria:**
- Migration applies cleanly via `supabase db push` (additive, idempotent).
- New plantings of a variety inherit profile templates with supply + end_date + source_template_id set.
- Existing instance-copies remain unaffected (NULL source_template_id is correct backwards-compat).
- Tests: `npm run test:run` clean. Add 1-2 unit tests around `copyCareTemplatesToInstance` covering supply propagation + source_template_id.

**Push gate per CLAUDE.md SQL tier:** code-tier (additive idempotent SQL) → needs "yes build" greenlight per push. Not always-ask.

### 7.2 Chunk C2 — Cascade Confirm popup + Action 1 (create-template cascade) (M)

**Scope:**
- New component `CareCascadeConfirm.tsx` per §2.4 spec (popup shell, copy, action buttons, error/loading states).
- Wire into `CareScheduleManager.handleSave` to fire when adding a NEW template AND existing instances exist for the profile.
- On "Apply to {N} plants" → bulk INSERT of instance-copies with `source_template_id` set + sibling-edge skip per §2.5.
- After success → call `generateCareTasks(userId)` → onChanged callback → toast.

**Effort:** M (~3-5h). New popup component + new bulk-insert utility + wiring.

**Dependencies:** Chunk C1 (needs `source_template_id` column to exist).

**Acceptance criteria:**
- Adding a new schedule to a profile with existing instances → popup appears with correct {N} count.
- "Apply to N plants" → instance-copies appear under each existing instance's Care tab (verified after C4 ships; in C2 verify via Supabase Studio + Calendar shows new tasks).
- "Cancel" → template saved at profile level; no instance-copies created.
- Sibling-edge skip: archived/dead/soft-deleted instances NOT included in {N} count or in the bulk INSERT.
- Tests: unit-level on the bulk-insert utility (mock supabase); integration-level via existing Vault tests if useful.

### 7.3 Chunk C3 — Cascade Confirm popup + Action 3 (edit-template cascade + locally-edited sub-prompt) (M)

**Scope:**
- Extend `CareCascadeConfirm` to also fire on template EDIT.
- Add local-edit detection: at popup-fire time, diff each instance-copy against the template's OLD values (need to snapshot pre-edit values before the UPDATE lands) — sub-prompt shows {M} of N count.
- Sub-prompt checkbox "Overwrite locally edited copies" defaults OFF.
- On confirm → bulk UPDATE per §2.2 Action 3 rules.

**Effort:** M (~3-5h). Cascade + diff logic + sub-prompt UX.

**Dependencies:** Chunk C2 (popup component exists), Chunk C1 (`source_template_id` available for the diff query).

**Acceptance criteria:**
- Editing an existing template → popup fires with correct {N} count of instances.
- If M instance-copies have been locally edited, sub-prompt appears with correct {M} count.
- "Apply" → fields propagate to instance-copies; locally-edited copies stay unchanged unless checkbox ON.
- "Apply" with checkbox ON → all copies force-overwrite to new template values.
- Cancel → template edit saved at profile level; instance-copies unchanged.
- Tests: unit-level on diff logic + bulk-update logic.

### 7.4 Chunk C4 — Instance Care tab inside GrowInstanceModal (M-L)

**Scope:**
- Extend `ActiveTab` type at [GrowInstanceModal.tsx:54](../../src/components/GrowInstanceModal.tsx:54) to include `'care'`.
- Add Care tab button in the tab row at [GrowInstanceModal.tsx:766](../../src/components/GrowInstanceModal.tsx:766).
- Add Care tab content panel — renders `CareScheduleManager` with new props `isInstanceLevel={true}` + `growInstanceId={instance.id}`.
- Extend `CareScheduleManager` to accept new props per §3.4 — handles inheritance badge rendering + skips cascade prompts when in instance-level mode.
- Render the inheritance-context banner (§3.2) at top.
- Render schedule cards with inheritance badges (Inherited / Overridden / none) per §3.3.
- Empty state per §3.5.
- Deep-link support: `?openInstance=<id>&tab=care&focusSchedule=<id>` per §4.3.

**Effort:** M-L (~4-7h). New tab + extending CareScheduleManager + inheritance badge render + deep-link plumbing.

**Dependencies:** Chunks C1 + C2 + C3 (the foundation for inheritance semantics).

**Acceptance criteria:**
- Opening GrowInstanceModal shows 3 tabs: Overview / Care / History.
- Care tab shows the inheritance banner + schedule cards + correct badges.
- Adding a schedule on instance Care tab → creates instance-only schedule (no cascade prompt).
- Editing an inherited schedule → updates instance-copy only (no template propagation back).
- Calendar deep-link → opens modal to Care tab, scrolls to focused schedule.
- Tests: extend existing GrowInstanceModal tests with Care tab open/close + render.

### 7.5 Chunk C5 — Skip-today + Catch-up affordance + "Apply to existing plants" template retro button (S-M)

**Scope:**
- Per §5.3: catch-up affordance on schedule card when overdue. Inline expander with Option A (mark + advance) + Option B (mark missed). Recommended default Option A.
- Per §5.4: skip-today affordance on schedule card. Tap-link "Skip" next to "Next:" date. Confirm popup. On Yes → soft-delete next-due task + advance schedule.
- Per §3.1: "Apply to {N} existing plants" link on profile template cards when N ≥ 1 instances without copies exist. Fires the cascade-confirm popup retroactively.
- Skip → Walter tap-discoverable (NOT swipe-only).

**Effort:** S-M (~3-4h). Small UX adds layered on the existing schedule card primitive.

**Dependencies:** Chunks C1 + C2 + C3 + C4 (Care tab and cascade popup must exist).

**Acceptance criteria:**
- Overdue schedule card shows "Overdue" indicator + catch-up inline expander.
- "Mark today, advance" → task marked complete, next_due_date advances.
- "Skip" → task soft-deleted, schedule advances to next eligible date (NOT marked complete).
- "Apply to existing plants" link → fires cascade popup retroactively.

### 7.6 Chunk C6 (OPTIONAL) — `tasks.category` widening + Calendar chip differentiation (S)

**Scope:**
- Migration: drop old `tasks_category_check` constraint + add expanded CHECK including `water / spray / repot / mulch`.
- Code: remove the collapse-to-maintenance branch in [generateCareTasks.ts:24](../../src/lib/generateCareTasks.ts:24).
- Calendar chip color / icon: differentiate `water` (sky-blue?), `spray` (amber?), `repot` (brown?), `mulch` (tan?) — Section 8 Q5 surfaces this color/icon mapping.

**Effort:** S (~2h). Migration + small TS change + Calendar styling. Color choices need Syd ratification.

**Dependencies:** Chunks C1-C5. Optional ship; defer to v1.x polish if Syd ratifies the "maintenance-collapse OK for v1 dogfood" path.

**Acceptance criteria:**
- Existing tasks with `category='maintenance'` stay unchanged (backwards-compat).
- New care schedules with category `water` / `spray` / `repot` / `mulch` generate tasks with matching category instead of collapsing.
- Calendar chip color/icon differentiates the new categories.

### 7.7 ~~Chunk C7 (OPTIONAL) — Household-shared tasks RLS (XS)~~ CLOSED 2026-05-29

**Status:** No-op. The `household_tasks_select` policy already exists on remote via `supabase/migrations/20250302000000_household_rpc_and_emails.sql:85-88` (Phase C Chunk C1 `76bf36c` confirmed during Pass-1 fact-check). Gap J premise (§1.3) was wrong — household members already see each other's tasks for shared-visibility. No migration to ship; no v1.x scope. Optional v1.x chunk list now reduces to **C6 (`tasks.category` widening) only**.

### 7.8 Chunk sequencing summary

| Chunk | Scope | Effort | Depends on | v1 required? |
|---|---|---|---|---|
| C1 | Schema migration + strict-bug fixes | XS-S | — | YES |
| C2 | Cascade Confirm popup + Action 1 | M | C1 | YES |
| C3 | Action 3 cascade + locally-edited sub-prompt | M | C1, C2 | YES |
| C4 | Instance Care tab in GrowInstanceModal | M-L | C1, C2, C3 | YES |
| C5 | Skip / catch-up / retro-apply | S-M | C1-C4 | YES |
| C6 | tasks.category widening (optional) | S | C1-C5 | NO (defer v1.x) |
| C7 | Household tasks RLS (optional) | XS | — | NO (per Q6) |

**Total v1 effort (C1-C5):** ~13-22h.
**Optional v1.x effort (C6-C7):** ~2-3h.

**Dogfood gates between chunks:**
- After C1: verify migration applied cleanly + new plantings inherit supply correctly. No UX-visible change, but a Supabase Studio spot-check.
- After C2+C3: verify cascade popup behavior on a real profile with real instances. UX-visible; Syd dogfood loop.
- After C4: verify instance Care tab on phone — Syd's primary dogfood. THIS is the biggest visible change.
- After C5: Syd dogfoods skip + catch-up flows.
- After C6 (if shipped): Calendar chip color differentiation; Syd verifies.

**Recommended ship cadence:** C1 standalone; C2+C3 bundled; C4 standalone; C5 standalone. Four ships total. Dogfood loop between each. Lines up with Sprint 2 + Sprint 3 cadence per gt_v1_scope.md §4.

---

## Section 8 — Open questions for Syd

Each question is a vision/persona decision Claude can't make alone. Recommended default first; alternative below it. Most are quick ratifications.

### Q1 — Cascade mental model: eager-snapshot (recommended) vs lazy-merge?

**Why this matters:** The whole inheritance model hangs on this. §2.1 recommends eager-snapshot: profile templates copy at Plant time, edits propagate via explicit cascade prompt. Alternative: lazy-merge where instance reads always JOIN against the template and compute effective values at render — feels more "live" but is a rewrite of `generateCareTasks`.

**(A) Eager-snapshot with cascade prompts (Recommended)** — keeps existing copy-on-plant pattern; explicit "apply to existing?" prompt at template create/edit; predictable user mental model. Effort: M (Chunks C1-C3 as scoped).

**(B) Lazy-merge** — instance-copies are "ghost rows" computed on-the-fly from the template + a small override delta. More technically elegant, more surprising at the UX layer ("my schedule changed without me touching it!"). Effort: L (rewrites materialization, deeper test surface).

### Q2 — Promote instance-only schedule to profile template?

**Why this matters:** Per §2.2 Action 2, an instance-only schedule does NOT propagate. If user adds a schedule on Plant A's Care tab and wants it on all plants of that variety going forward, they have to navigate to the profile and add it again. Should the instance Care tab offer a "Promote to profile template?" affordance?

**(A) NO promote affordance in v1 (Recommended)** — keeps the flow simple. Friction is small (the user knows they want it on all plants → they navigate to profile). Avoids "is this a profile-level edit or instance-level?" confusion. Surface as a v1.x polish if dogfood reveals real friction.

**(B) Add "Promote to profile template?" on instance Care tab edit form** — checkbox or small button below Save. On confirm → INSERT a new template at profile level + cascade-prompt to apply to all sibling instances. Adds ~XS scope. Risk: confuses Sam-persona who doesn't know what "template" means.

### Q3 — Cascade Action 1 "Apply to existing": next_due_date computed from today or from instance's sow_date?

**Why this matters:** When a new template cascades to existing instances, the instance-copy needs a `next_due_date`. Two reasonable choices.

**(A) Compute from today (Recommended)** — for every existing instance, `next_due_date` = today + interval (or current-month-day for monthly, etc.). Simpler, predictable; "schedule starts now for all my plants." User intuition matches "I just added this — it should kick in now."

**(B) Compute from each instance's sow_date** — for every existing instance, recompute as if the template had been there at planting. Means an instance planted 60 days ago with a "fertilize every 30 days" schedule would have next-due = sow_date + 60 days = today (which fires now); but a 10-day-old instance would have next-due = sow_date + 30 days = 20 days from now. More mathematically pure; harder to explain. Could shock-stack if many overdue tasks materialize at once.

### Q4 — "Reset to template" action for overridden instance-copies?

**Why this matters:** Per §2.2 Action 4, an instance-copy that's been locally edited has no explicit "reset to template" affordance. User has to delete and let the next template-edit cascade re-create it. Should v1 add an explicit Reset?

**(A) NO Reset in v1 (Recommended)** — low-frequency action; delete + cascade-re-create is workable. Reduces scope. v1.x add if dogfood demands.

**(B) Add Reset to template** — on overridden instance-copies, show "Reset to default" button. On tap → UPDATE the instance-copy fields to match the source template. Effort: XS. Maya persona may want this for multi-batch reset.

### Q5 — Widen `tasks.category` CHECK to include `water / spray / repot / mulch`?

**Why this matters:** Per Gap H + Chunk C6, today's narrow CHECK collapses water/spray/repot/mulch to `maintenance`. Calendar shows them all as the same chip color + icon. Widening unlocks per-category color/icon differentiation — but requires picking colors (which is an aesthetic decision, not engineering).

**(A) Defer widening to v1.x (Recommended)** — v1 ships with maintenance-collapse. Calendar still groups them under one bucket, but the schedule's own category vocabulary (water/spray/etc.) is preserved on the care_schedules table. Users see correct labels when looking at schedules; only Calendar chip color is generic. Acceptable for v1 dogfood scale per gt_v1_scope.md cohesion bar.

**(B) Widen in v1** — requires Syd picking color/icon for each new category. Surface as: water → sky-blue droplet; spray → amber spray-bottle; repot → brown pot; mulch → tan leaf. ~S effort + per-category aesthetic decisions.

### Q6 — ~~Add household peer-read RLS on `tasks` for family-view shared visibility?~~ MOOT 2026-05-29

**Verified shipped pre-Phase-C; no v1.x action needed.** The `household_tasks_select` policy already exists on remote via `supabase/migrations/20250302000000_household_rpc_and_emails.sql:85-88` (Phase C Chunk C1 `76bf36c` confirmed). Question is moot — household members already see each other's tasks for shared-visibility "Mom watered yesterday." Gap-J premise (§1.3) was wrong; C7 (§7.7) is closed.

### Q7 — "Overridden" badge color on instance Care tab schedule cards?

**Why this matters:** §3.3 recommends amber (`bg-amber-50 text-amber-700`) for "Overridden" — no anchor in codebase, new pattern. Three reasonable alternatives.

**(A) Amber (Recommended)** — distinct from neutral (Inherited), distinct from emerald (selected/STATE). Signals "you intentionally diverged from default; we're showing you so."

**(B) Neutral with italic "Overridden" label** — no color; just typography. Less visually noisy; less discoverable.

**(C) Emerald-100 with darker text** — would be cohesive with existing selected-state usage but mis-signals "overridden = good thing."

### Q8 — Instance Care tab sort: by `next_due_date` or alphabetical?

**Why this matters:** §3.6 recommends sort by next_due_date ASC. Care tab is action-oriented; "what's coming up next" reads more naturally than "fertilize, prune, water" alphabetical.

**(A) `next_due_date` ASC, alpha tiebreak (Recommended)** — action-first. Anchors to Calendar's sort framework.

**(B) Alphabetical by title** — fixed reference list; predictable position. Helps when user knows the schedule name and doesn't care about timing.

### Q9 — Dedicated `/care/` cross-profile route in v1?

**Why this matters:** §4 recommends keeping care tied to its surface (profile / instance / Calendar / Home). A standalone `/care/` aggregator was considered and parked. v1 vs v1.x?

**(A) NO dedicated /care/ route in v1 (Recommended)** — Calendar + Home already aggregate; standalone route would duplicate; doesn't fit the 6-tab nav lock. v1.x candidate if dogfood reveals real "I want one place to see all care" friction.

**(B) Build /care/ route in v1** — adds Sprint 3 work; needs nav decision (where does it live? Settings? Home dashboard link?); marginal user value beyond Calendar.

### Q10 — Catch-up affordance: inline expander on schedule card or small confirm modal?

**Why this matters:** Per §5.3, when a schedule is overdue, user needs a "catch up" action. Two patterns.

**(A) Inline expander on the schedule card (Recommended)** — taps "Overdue" indicator → card expands with Option A (Mark today + advance) and Option B (Mark missed) buttons. Discoverable, compact, no modal context-switch. Adds vertical density to the card.

**(B) Small confirm modal** — taps "Overdue" → modal with the two options. Less density on the card; more click-friction.

### Q11 — Add `tasks` tab on GrowInstanceModal in addition to Care tab?

**Why this matters:** §5.6. Today the modal shows overview + history; Phase C adds care. Should it also add tasks (showing all generated + manual tasks past + upcoming for this instance)?

**(A) NO tasks tab in v1 (Recommended)** — Calendar already shows tasks per-instance; duplicating would add UI without much added affordance. History tab can grow to cover completed-task review.

**(B) Add tasks tab** — XS-S scope; uses Calendar's task query filtered to this instance. Useful for "show me everything I've done for Plant A this season." Sequencing: ship after C5.

### Q12 — In-form "+ Add to Shed" supply add path: ship in v1 Care tab or defer?

**Why this matters:** §6.3 proposes adding a mini-flow to create a new supply without leaving the schedule form. Adds discoverability for first-time supply adds; but is its own ~S-M scope (mini-Shed-add form).

**(A) Defer to v1.x polish (Recommended)** — keep existing empty-state copy *"Add products in the Shed to link them here."* for v1. Supply add flow stays at Shed. Workable; not a v1 cohesion-bar blocker.

**(B) Ship in v1 Phase C** — adds a chunk; M-sized; depends on Shed-add flow being extractable. Useful for Aria (houseplant — first supply add likely during care setup).

### Q13 — Section 8 ratification path

If Syd is short on bandwidth, she can ratify all 12 Recommended defaults in one message: *"all Q1-Q12 defaults locked"* and Phase C kicks off with the data model + chunks as defined. Any she wants to override gets named individually.

The cascading questions: **Q1 (eager vs lazy) is foundational** — overriding to (B) lazy-merge effectively rewrites Chunk C1-C3. **Q5 + Q6 + Q11 + Q12 are optional adds** — overriding any to (B) extends Phase C by the named effort. **Q2 + Q4 + Q9** are v1-vs-v1.x debouncers — overriding to (B) adds polish to v1 but extends timeline.

---

## Recommendations summary

- **Data model:** existing schema ~90% sufficient. ONE additive migration (`care_schedules.source_template_id` column + index). Strict-bug fixes to `copyCareTemplatesToInstance` (copy supply + end_date + set source_template_id). Optional widening of `tasks.category` CHECK + household tasks RLS — both gated on Section 8 Q5/Q6.
- **Inheritance model:** CSS-cascade-like, eager-snapshot, four canonical actions with cascade prompts on profile-level create/edit (Sections 2.1-2.6).
- **UI surfaces:** profile-level Care tab (existing — extend) + instance-level Care tab (NEW, inside GrowInstanceModal as third tab between Overview and History).
- **Routes:** no new routes in v1. Calendar deep-link extended to open the modal's Care tab for instance-scoped tasks.
- **Task scheduling:** existing generateCareTasks + advanceCareSchedule path stays. Adds catch-up affordance + skip-today on schedule cards.
- **Supply picker:** keep Pattern A (single-select dropdown) on care schedule form. Optional in-form "+ Add to Shed" mini-flow gated on Q12.
- **Phase C implementation:** 5 chunks for v1 (C1-C5; ~13-22h focused), 2 optional v1.x chunks (C6-C7; ~2-3h).

**Next move after Syd ratifies Section 8:** spawn Phase C chunk C1 (schema migration + strict-bug fixes) as the first implementation chat. C1 is XS-S, low-risk, no UX surface — fastest validation that the migration applies cleanly + the substrate fix lands without regression.

---

*End of design pass. Read-only — no code modified outside this doc.*

