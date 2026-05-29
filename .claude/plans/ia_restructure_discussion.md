# Plan — IA Restructure Discussion (4-move consolidation)

> **CORRECTION 2026-05-28:** Move #1 "Plant Profiles → top-level 'Plants' tab" renamed at ship-time to **"Library"** label (preserves the existing encyclopedia term Syd already uses; "Plants" was a placeholder during planning). Final nav order: Home → Library → Garden → Vault → Calendar → Journal (Library precedes Garden). Move #1 substance unchanged — tab still owns plant profiles; only the label + order shifted. See ROADMAP §6 2026-05-28 Ship A correction note for rationale.
> **Status:** Read-only discussion plan doc. NO code, NO migrations, NO Preview MCP. Captured 2026-05-28.
> **Type:** Plan-first audit before any implementation chapter spawns.
> **Anchor docs read:** [VISION.md](../../docs/VISION.md) §1-§12 · [CLAUDE.md](../../CLAUDE.md) · [PERSONAS.md](../../docs/PERSONAS.md) · [REDESIGN_2026-05-18_add-entry-organization.md](../../docs/REDESIGN_2026-05-18_add-entry-organization.md) · [docs/plans/merge-active-garden-my-plants.plan.md](../../docs/plans/merge-active-garden-my-plants.plan.md) · [ROADMAP.md](../../docs/ROADMAP.md) §1+§3+§4
> **NORTH_STAR.md flag:** brief references a `NORTH_STAR.md` doc that does NOT exist in this repo. Substituted: VISION §8 design conventions + CLAUDE.md cohesion principles + ROADMAP §6 dated locks. Every recommendation cites a named principle from these docs. If NORTH_STAR.md exists in another form (e.g. a single-line locks file from the skeleton checklist that didn't ship), the doc-architecture-split work is parked at VISION §11 "AGENTS.md doc-architecture split" — Syd to clarify if a separate NORTH_STAR file is intended.

---

## 0. The 4 moves to consolidate

For reference (verbatim from chat brief):

1. **Plant Profiles → top-level "Plants" tab** (locked 2026-05-27). Library exits Vault; becomes own top-level tab. Vault collapses to Packets + Shed.
2. **"+Add Variety" button moves from Library toolbar → FAB menu** (locked 2026-05-28). Inline toolbar button removed; new FAB chip.
3. **Active Garden + My Plants tabs MERGE into unified "Garden" tab** (locked 2026-05-28). One tab; lifecycle-based split dissolved.
4. **User-defined groups feature** (locked 2026-05-28, NEW feature). Patio / Front yard / Bedroom-style user-defined labels. M-N (plant in many groups).

### Strategic framing — these 4 are NOT independent

Moves 3+4 are **the same single decision**. The merge (#3) without groups (#4) would land users on an unsegmented Garden tab and feel worse than today. Groups (#4) without the merge (#3) is impossible — the merge IS what creates the surface where groups become the primary nav. Treat #3+#4 as one ship.

Moves 1+2 are **mechanically independent of #3+#4** but **share the FAB-restructure surface** — moving Library out of Vault (#1) reshapes the Vault toolbar in the same chunk as moving Add Variety to FAB (#2). Bundle #1+#2.

So the real strategic question is: **bundle as one massive ship (#1+#2+#3+#4), or phase as two bundled ships (#1+#2 then #3+#4)?** Recommendation in §5.

### Strategic framing — leverage prior locked work

This IS NOT a from-scratch IA design. Two prior shipped/planned artifacts already locked the load-bearing decisions:

- **REDESIGN_2026-05-18 §3.4** already locked "Zones" — user-defined location-based tabs, drag-reorder, soft cap 10 zones × 15 chars, "Garden" system default zone with smart show/hide, "+" tab-bar creation + Manage screen + at-add-plant-time autocomplete creation, deletion only from Manage screen. **This is the same feature as the current brief's "groups."** Terminology mismatch is the only delta — see §2 Recommendation.
- **`docs/plans/merge-active-garden-my-plants.plan.md`** already locked the data-layer + state-tree collapse for Active Garden + My Plants merge. ~17 duplicate state branches → ~17 unified. Single query. Sort axes recommendation. URL migration. sessionStorage migration. Risk table.

This IA chapter is the consolidation of prior work + 2 new moves (#1 Plants tab + #2 Add Variety to FAB), NOT 4 new IA decisions. Saves ~6-8 hours of from-scratch design.

---

## 1. Proposed final IA

### 1.1 Bottom nav — 6 tabs

**Recommendation:** 6 tabs — `Home / Garden / Plants / Vault / Calendar / Journal`.

```
[Home] [Garden] [Plants] [Vault] [Calendar] [Journal]
```

Tab semantics:

| Tab | What it owns | Why |
|---|---|---|
| **Home** | Context-aware dashboard, Plant This Month widget, weather, FAB | Unchanged. VISION §7 Home. |
| **Garden** | User's actual plants (instances) organized by user-defined groups | Merge of Active Garden + My Plants per brief #3. Groups replace lifecycle-split. |
| **Plants** | Plant profile encyclopedia (Library) | Promoted from Vault sub-tab per brief #1. **New top-level.** |
| **Vault** | Packets (seed inventory) + Shed (supply inventory) | Collapsed from 3 sub-tabs to 2 per brief #1. **Becomes the inventory hub.** |
| **Calendar** | Task management + Plantable | Unchanged. VISION §7 Calendar. |
| **Journal** | Action log + photos | Unchanged. VISION §7 Journal. |

**Bottom nav width concern.** Today's BottomNav is 5 tabs in a 64-wide flex-around inside `max-w-lg mx-auto`. 6 tabs in the same container = ~85px per tab including padding. Touch targets stay above 44px (icon column + small label) at phone widths down to 360px, but tightly. **Recommendation per brief:** responsive treatment — icons-only on phones (width < 412px), icons + labels on tablet+ (≥412px). Anchored in [BottomNav.tsx:18](../../src/components/BottomNav.tsx:18) — `flex items-center justify-around h-16 max-w-lg mx-auto px-2` already constrains the container. Add a `hidden xs:inline-block` class on the label `<span>` if needed at narrowest widths, or simply rely on Tailwind's `text-xs` legibility (already in code).

**Active state.** Current `text-emerald` for active per [BottomNav.tsx:27](../../src/components/BottomNav.tsx:27). Unchanged — anchored in VISION §8 chrome convention (currently emerald-500 family for state per §8 emerald split — state surface, not CTA).

**Tab order rationale.** Home first (always anchor); Garden + Plants together (both "my stuff" but instances vs encyclopedia); Vault next (inventory, distinct from "my plants"); Calendar (task layer); Journal (record layer). **Counter-option considered:** Home / Plants / Garden / Vault / Calendar / Journal (encyclopedia before instances) — rejected because user typically taps Garden multiple times per session (active management) vs Plants infrequently (lookup); Garden gets the higher-frequency position. Anchored in VISION §3 audience model — most users 90% Active management plane, 10% Memory plane lookup.

**Recommendation anchored in:** VISION §6 Failure Mode 4 ("Disorientation — user gets lost"). Bottom nav is the user's primary spatial anchor; the IA split between "my plants" (Garden), "encyclopedia" (Plants), and "inventory" (Vault) closes the mental-model gap where the current Vault tab does double duty as encyclopedia + inventory.

### 1.2 Per-tab internal nav

#### Home
**No change** from current.

#### Garden (merged + groups)
Top-of-page shell:

```
[Garden]                                              [⋯ Manage Groups]
[Search________________]  [⛀ Refine]  [↕ Sort]  [▦ Display]

( All ) ( Patio ) ( Front Yard ) ( Bedroom ) ( + )    <-- group tabs (user-defined)
─────────────────────────────────────────────────
[ rendered plants for active group ]
```

**Group tabs** = primary intra-Garden nav, replacing the current `[Active Garden | My Plants]` toggle. Drag-reorder. "All" pinned leftmost, always shown. "+" rightmost, opens inline "Create group" flow (REDESIGN §3.4 pattern). Soft cap: **10 groups × 15-char names** (matches REDESIGN §3.4 Zones cap verbatim — same rationale: avoids horizontal-scroll abuse + tab-name-truncation drift).

**System default "Garden" group** — smart show/hide per REDESIGN §3.4:
- Brand-new user: no group tabs visible; empty-state copy.
- First plant added without explicit group: "Garden" materializes; plant lands there.
- User creates own groups AND no plants in "Garden": "Garden" auto-hides.
- User later adds plant without explicit group: "Garden" reappears.

**Multi-assignment display.** When a plant belongs to 2+ groups (e.g. "Tomatoes" in "Patio" + "Back yard"), tap "Patio" → shows it; tap "Back yard" → also shows it. Card displays no badge by default ("Add badges to plant cards" criterion fails REDESIGN §3.5 must-pass test — informational density, not actionable). Multi-assignment is visible only in Manage Groups OR plant detail.

**"All" tab semantics.** Shows every plant once (de-duped). Sort respects single chosen axis. Search filter respects across all groups.

**Recommendation anchored in:** REDESIGN §3.4 Zones (this brief's "groups" = REDESIGN's "Zones" — same feature, see §2). VISION §6 Failure Mode 4 (cohesion).

#### Plants (new top-level — was Vault Library)
Top-of-page shell:

```
[Plants]                                              [⋯]
[Search________________]  [⛀ Refine]  [↕ Sort]  [▦ Display]

[ ↑ note: NO inline "Add Variety" button — moved to FAB per brief #2 ]
─────────────────────────────────────────────────
[ plant profile cards — gallery/list per existing toggle ]
```

**Internal structure:** identical to current Library view inside VaultPageContent, just lifted out. All existing functionality preserved verbatim:
- Search + Refine + Sort + Display-style toggle
- Batch select + Selection actions
- Plant Variety merge flow
- Schedule sowing flow
- Photo/condensed grid modes (per VISION §8 default-sort discovery convention — most-recent first; current code defaults `name asc`, framework lock pending per ROADMAP §1)

**Subroutes preserved:** `/vault/[id]` (plant profile detail) stays as-is — those URLs are deep-linked from many other surfaces. Recommendation: **don't move detail routes** during this IA shift. The list view moves to `/plants`; the detail view stays at `/vault/[id]/...` until a separate route-rename chapter. Cleaner cut, smaller blast radius.

**Counter-option considered:** rename `/vault/[id]` → `/plants/[id]`. Rejected for THIS chapter — adds ~30+ deep-link references to update across the codebase (sidebar nav, Calendar Plantable, FAB nav, household-view rows, journal entry links, achievement badges, profile-from-grow back-button), AND breaks all bookmarks the user or sister has. Better as a separate URL-cohesion chapter post-IA-ship.

**Recommendation anchored in:** VISION §1 ("encyclopedia" as one of the 4 roles); separates "look up plant info" mental task from "manage my plants" mental task — closes VISION §6 Failure Mode 4 mental-model-mismatch root cause.

#### Vault (collapsed to Packets + Shed)
Top-of-page shell:

```
[Vault]                                                [⋯]
[Search________________]  [⛀ Refine]  [↕ Sort]  [▦ Display]

[ Packets ] [ Shed ]                                <-- 2 tabs (was 3)
─────────────────────────────────────────────────
[ Packets list/grid OR Shed list/grid ]
```

Vault becomes **the inventory hub** — pure inventory surfaces (consumable supplies). Library exits to its own top-level tab. Lossy nothing: Packets + Shed already share the same lookup-surface mental model per VISION §8 default-sort framework (both alphabetical by name).

**Implementation note for the §5 plan:** VaultPageContent's `viewMode` state ([VaultPageContent.tsx:148](../../src/app/vault/VaultPageContent.tsx:148)) currently has 3 values — `"grid" | "list" | "shed"`. Drop `"grid"` (Library) — that branch migrates to the new `/plants` route. Vault's 2-tab toggle becomes `"list" | "shed"` (packets vs shed). URL: `/vault?tab=packets` and `/vault?tab=shed`. Legacy `?tab=grid` redirects to `/plants` (the new home).

**Recommendation anchored in:** VISION §8 default-sort discovery vs lookup framework — Packets + Shed are both lookup surfaces (alphabetical by name); Library is a discovery surface (most-recent first per the framework — though current code defaults alphabetical). Putting them together at Vault tightens the surface's mental category.

#### Calendar
**No change** from current.

#### Journal
**No change** from current.

### 1.3 FAB menu structure (proposed final)

See §4 for full rationale. Summary: 6 top-level chips (currently 5), restructured per moves #2.

```
[Add]
  ├─ Add Variety              (NEW per brief #2 — moves from Library toolbar)
  ├─ Add Seed Packet
  ├─ Add Plant
  │   ├─ Manual Entry
  │   ├─ From Vault
  │   ├─ Scan Purchase Order
  │   └─ Photo Import
  ├─ Add to Shed
  ├─ Add Task
  └─ Add Journal
[Cancel]
```

**Add Variety positioning:** TOP of the menu (before Add Seed Packet). Anchored in REDESIGN §3.1 row ordering — inventory-flavored adds come first (Variety = encyclopedia/library inventory of profiles; Seed Packet = physical inventory of seeds). Pairs naturally with Add Plant (the instance-flavored add). Group orders: Variety (encyclopedia) → Seed Packet (inventory) → Plant (instance) → Shed (supply) → Task (lifecycle layer) → Journal (record layer).

**Counter-option considered:** Add Variety as a sub-screen under Add Plant. Rejected — Add Variety has zero conceptual overlap with Add Plant. Add Variety creates a `plant_profiles` row with no packet, no instance, no growth state — it's an "I'm building my reference encyclopedia" act. Add Plant creates a `grow_instances` row attached to an existing profile. Different intents, different forms, different mental models. Nesting them would re-create exactly the disorientation pattern VISION §6 Failure Mode 4 is trying to defeat. **Recommendation locked: top-level chip.**

### 1.4 User mental model post-restructure

The new mental model an end-user lands on:

> "My garden is the place I actually have plants (Garden tab). My plants encyclopedia is where I look up info on varieties I'm interested in or own (Plants tab). My inventory is the stuff I keep around to plant or care for plants (Vault — Packets + Shed). My schedule is when stuff needs to happen (Calendar). My record is what I did (Journal)."

Each tab maps cleanly to one mental category. No tab does double duty. The Vault-as-encyclopedia-AND-inventory mental conflict that currently exists dissolves: Vault becomes consistently "inventory" (consumable), Plants becomes consistently "encyclopedia" (reference).

**Persona walk on the proposed IA:**

- **Maya (power gardener, 200+ items):** ✅ Win. Groups give her zone-based filter ("show me everything in the greenhouse"), encyclopedia separation gives her fast variety-lookup, inventory separation lets her check packet stock without scrolling past varieties.
- **Sydney (spring planner, ~60 items):** ✅ Win. Less "lost" feeling per VISION §6 Failure Mode 4 — clearer mental model. Familiar tab labels with new internal organization.
- **Walter (retiree, 50-100 perennial-heavy):** ✅ Win. Groups respect his "tomatoes go in the back bed; dahlias in the front" mental model directly (today's lifecycle-based "Active Garden / My Plants" split forces him to think in terms of botanical classification, which doesn't match his domain knowledge). Tap-only nav stays intact.
- **Aria (urban houseplant, 8-15 plants, indoor only):** ✅ **Massive win.** Today's "Active Garden / My Plants" split forces her into "My Plants" with no further organization; new groups let her create "Living Room", "Bedroom", "Office" tabs that match her spatial mental model. ALSO solves the long-standing VISION §11 + REDESIGN §3.4 concern about "outdoor-garden assumptions" — Aria's Garden tab now reads correctly with her own indoor labels.
- **Sam (first-time beginner, 1-3 plants):** ✅ Win. Empty-state copy on Garden tab guides them ("Add a plant or set up a group to get started" per REDESIGN §3.4); Plants tab provides browsable encyclopedia without forcing them to commit to growing anything; FAB structure is approachable.

**All 5 personas pass.** Strongest improvement: Aria + Walter (currently misframed by the lifecycle-based split).

**Recommendation anchored in:** VISION §6 Failure Mode 4 (Disorientation — user gets lost). VISION §3 audience model (3 user modes, 5 personas via PERSONAS.md). PERSONAS.md cross-persona scan validates all 5 personas served.

---

## 2. Data model for user-defined groups

### 2.1 Terminology reconciliation — Zones vs Groups

**This brief calls them "groups." REDESIGN_2026-05-18 §3.4 calls them "Zones."** Same feature, different label.

**Recommendation: adopt "Groups" per this brief (2026-05-28 latest lock).**

Reasoning:
- "Zones" risks confusion with USDA hardiness zones (Zone 10b, etc.) — REDESIGN §3.4 explicitly flags this risk and mitigates only via empty-state copy. Garden Tracker has more USDA-zone surfaces than most apps (Settings → Profile, "When to Plant by Zone", "Plant this month") so the namespace collision is a real risk for Walter + Aria + Sam personas.
- "Groups" is plain language; matches the brief's framing ("Patio", "Front yard", "Bedroom" — none of which sound zone-flavored).
- 2026-05-28 lock supersedes 2026-05-18 lock per CLAUDE.md authority precedence ("VISION.md wins for product scope... When a doc-vs-doc conflict is spotted, surface it explicitly").

**Doc reconciliation cost:** REDESIGN §3.4 + §3.10 (migration plan) + §3.5 cross-refs use "zone" 12+ times. Rename to "group" in REDESIGN_2026-05-18.md AS PART OF the IA chapter ship (small doc edit, prevents future drift). VISION §11 doesn't reference Zones; ROADMAP §3.4 Beds-as-first-class doesn't use the term Zones either. So the doc-edit is contained to REDESIGN_2026-05-18.md.

**Alternative considered:** keep "Zones" — adds garden-domain flavor, aligns with REDESIGN's earlier lock, and Garden Tracker already has zone-aware features ("When to Plant by Zone"). Rejected because the namespace collision risk is too high for the Walter + Aria + Sam personas (per PERSONAS.md scan in §1.4 above).

**Recommendation anchored in:** PERSONAS.md cross-persona walk (Walter + Aria + Sam confusion vector); CLAUDE.md authority precedence (2026-05-28 lock supersedes 2026-05-18 lock).

### 2.2 Existing schema audit — what's reusable

Inventory of existing fields that could be repurposed:

| Field | Current shape | Reuse for groups? |
|---|---|---|
| `grow_instances.location` text | Free-text label per [migrations/20250211000000:118](../../supabase/migrations/20250211000000_phase1_schema_foundation.sql:118) — currently displayed in `ActiveGardenView` as a chip | **Yes, partial.** Can migrate to a group FK + keep `location` as denormalized display string OR fully replace. See §2.4. |
| `grow_instances.is_permanent_planting` boolean | Lifecycle-classifier per [migrations/20250315000000](../../supabase/migrations/20250315000000_grow_instances_is_permanent_planting.sql) | Going away anyway per REDESIGN §3.13 (lifecycle moves to `plant_profiles.lifecycle_pattern`). Not relevant to groups. |
| `seed_packets.storage_location` text | Free-text per [migrations/20250222000000](../../supabase/migrations/20250222000000_seed_packets_storage_location.sql) — packet-storage location | **NOT for plant groups.** Packets have their own storage axis (different from where the planting is). Don't reuse. |
| `plant_varieties.tags` text[] | Legacy `text[]` array on legacy `plant_varieties` table per [migrations/20250204100000:16](../../supabase/migrations/20250204100000_big_shift_schema.sql:16) | **Not reusable.** Legacy table; arrays don't support drag-reorder or rename-safety. |
| `blocked_tags` table | AI tag filter blocklist per [migrations/20250209600000](../../supabase/migrations/20250209600000_blocked_tags.sql) | **Not reusable.** Different domain. |

**Finding: `grow_instances.location` is the closest existing field, but it's a free-text label, not a relational reference.** Migrating it directly to a typed group reference (FK) is the right move. See §2.4.

**No existing tags/groups/zones/beds table in the schema.** This is greenfield.

### 2.3 Proposed schema — Groups table + plant_groups join

**Recommendation: M-N (many-to-many) via a join table.**

```sql
-- Groups (user-defined organization labels for plants)
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,                                -- "Patio", "Front yard", "Bedroom"
  sort_order integer NOT NULL DEFAULT 0,             -- drag-reorder; lower = leftward
  is_system_default boolean NOT NULL DEFAULT false,  -- marks the auto-created "Garden" default
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,                             -- soft delete
  UNIQUE(user_id, name)                              -- per-user unique group names
);

CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_user_sort ON groups(user_id, sort_order);

-- Join: which planting is in which group(s)
CREATE TABLE IF NOT EXISTS plant_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grow_instance_id uuid NOT NULL REFERENCES grow_instances(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalized for RLS
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(grow_instance_id, group_id)                -- can't assign to same group twice
);

CREATE INDEX IF NOT EXISTS idx_plant_groups_grow ON plant_groups(grow_instance_id);
CREATE INDEX IF NOT EXISTS idx_plant_groups_group ON plant_groups(group_id);

-- RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own groups" ON groups
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own plant_groups" ON plant_groups
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**RLS pattern matches existing tables** ([migrations/20250209600000](../../supabase/migrations/20250209600000_blocked_tags.sql) blocked_tags + [migrations/20250204000000](../../supabase/migrations/20250204000000_garden_tables.sql) grow_instances).

**Household coexistence:** Groups are per-user (each user has their own group set). If household-shared garden is in flight, group lookup goes through HouseholdContext just like Plant Profiles does today — but each member sees their own group labels. **Recommendation: defer the household-shared-groups question to a follow-up chapter.** v1 ships per-user groups; v1.1 surfaces household-shared groups if dogfood reveals coordination friction. Anchored in VISION §3 "Layer 2 Household — Acts as shared identity by default; per-person attribution recorded for actions but hidden from UI by default."

**Counter-option considered: 1-N (one group per plant via `grow_instances.group_id` FK).** Rejected because:
- Brief explicitly locks "Plants assigned to one or many groups."
- Real use case: a tomato might legitimately be "Patio" + "Companion-planted with basil" + "Seed-saving target" simultaneously — three orthogonal organizational axes. M-N supports this without forcing the user to pick.
- Migration shape is the same complexity either way (still need a backfill from `location`).
- Maya persona (power user, 200+ items) NEEDS multi-grouping for the cross-axis comparisons she does in her head; 1-N would force her to pick the dominant axis.

**Recommendation anchored in:** VISION §3 (5-persona model — Maya power-user cross-axis); brief #4 explicit lock ("one or many groups"); existing schema FK pattern from grow_instances.

### 2.4 Migration — how existing plants get assigned

**Migration is required for ~all existing users** because today nothing is in a group (groups don't exist yet).

**Recommendation: per REDESIGN §3.10 — auto-create + auto-assign.**

```sql
-- Migration SQL (additive, idempotent — fits CLAUDE.md SQL migrations code-tier criteria)

-- Step 1: For each user who has at least one grow_instance, create a "Garden" group (system default)
INSERT INTO groups (user_id, name, sort_order, is_system_default, created_at)
SELECT DISTINCT user_id, 'Garden', 0, true, now()
FROM grow_instances
WHERE deleted_at IS NULL
ON CONFLICT (user_id, name) DO NOTHING;

-- Step 2: For each user who has at least one is_permanent_planting=true grow_instance, also create a "Permanent" group
INSERT INTO groups (user_id, name, sort_order, is_system_default, created_at)
SELECT DISTINCT user_id, 'Permanent', 1, true, now()
FROM grow_instances
WHERE deleted_at IS NULL AND is_permanent_planting = true
ON CONFLICT (user_id, name) DO NOTHING;

-- Step 3: Auto-assign each grow_instance to "Garden" OR "Permanent" based on is_permanent_planting
INSERT INTO plant_groups (grow_instance_id, group_id, user_id, created_at)
SELECT g.id, gr.id, g.user_id, now()
FROM grow_instances g
JOIN groups gr
  ON gr.user_id = g.user_id
  AND gr.name = CASE WHEN g.is_permanent_planting = true THEN 'Permanent' ELSE 'Garden' END
WHERE g.deleted_at IS NULL
ON CONFLICT (grow_instance_id, group_id) DO NOTHING;
```

**`grow_instances.location` repurposing:** keep `location` as a free-text DISPLAY field (existing chip in ActiveGardenView), separate from the group FK. Don't try to backfill `location` → group; users wrote informal labels like "back bed" + "near hose" that don't map cleanly to groups. Future polish chapter: prompt users to convert free-text location strings into groups via a guided UI pass.

**`is_permanent_planting` deprecation:** per REDESIGN §3.13, this column goes away once `lifecycle_pattern` lands on `plant_profiles`. Two paths:
- **(A)** Land the IA migration FIRST (groups + auto-assign per above), THEN land §3.13 lifecycle migration as separate ship. `is_permanent_planting` stays around for one phase.
- **(B)** Bundle both. IA migration reads `is_permanent_planting` for the seeding step AND simultaneously backfills `lifecycle_pattern` on profiles.

**Recommendation: (A) — sequential.** Smaller blast radius per ship. §3.13 lifecycle work has its own audit complexity (enrichment, profile UI redesign — REDESIGN Ship 5). Don't entangle.

**One-time onboarding tooltip** per REDESIGN §3.10: *"Your plants were sorted into Garden + Permanent groups. You can rename, add new groups, or move plants anytime — tap ⋯ Manage Groups."* Renders on first session after migration. Dismissable.

**Recommendation anchored in:** REDESIGN §3.10 migration pattern verbatim; CLAUDE.md SQL migrations subsection (additive idempotent = code-tier); VISION §10 "Empty-by-default" preserved (no plants → no groups visible).

### 2.5 Section 2 — Recommendation summary

1. Adopt **"Groups"** terminology over Zones; update REDESIGN_2026-05-18 §3.4 + §3.10 cross-refs same chapter.
2. New `groups` + `plant_groups` tables. M-N. Per-user. RLS-protected. Soft-delete.
3. Migration: auto-create "Garden" (always) + "Permanent" (if any permanent plants); assign each existing planting to its lifecycle-derived group. One-time onboarding tooltip.
4. Sequence: groups + migration FIRST; `lifecycle_pattern` enum (REDESIGN §3.13) as separate later ship.

**Anchored principle:** VISION §6 Failure Mode 4 (cohesion) + REDESIGN §3.4 prior lock + CLAUDE.md SQL migrations safety + PERSONAS.md cross-persona walk.

---

## 3. UI patterns for groups

### 3.1 Garden tab layout

**Three layout options considered:**

**Option A — Top-of-page group tabs (Recommended).**

```
[Garden]                                              [⋯ Manage Groups]
[Search________________]  [⛀ Refine]  [↕ Sort]  [▦ Display]

( All ) ( Patio ) ( Front Yard ) ( Bedroom ) ( + )    <-- horizontal scroll if needed
─────────────────────────────────────────────────
[ rendered plants for active group — same gallery/list as today ]
```

- Group tabs horizontal-scroll on phone widths if too many; max 10 groups + "All" + "+" = 12 max.
- "All" pinned leftmost. "+" pinned rightmost.
- Active tab visual = VISION §8 emerald-500 state token (sibling to existing Vault Library/Packets/Shed sub-tab pattern at [VaultPageContent.tsx:1002](../../src/app/vault/VaultPageContent.tsx:1002)).
- Single body below — same gallery/list rendering as today; no nesting.
- Cohesion anchor: this IS the existing Vault tab pattern. Same primitive, same emerald-500 active state, same scrollable tab row. Reuses the cohesion bar already locked.

**Option B — Collapsible sections per group on one scrollable page.**

```
[Garden]
[Search...]  [↕]

▼ Patio (8 plants)
[ plants ]

▼ Front Yard (12 plants)
[ plants ]

▼ Bedroom (3 plants)
[ plants ]
```

- All groups visible at once; sections collapse/expand.
- Pro: gives at-a-glance overview.
- Con: at Maya's scale (200+ items, 8 groups), the page becomes a wall-of-data. Same density-fatigue pattern flagged in VISION §6 Failure Mode 4 + ROADMAP §6 Calendar fatigue history.
- Con: doesn't scale to "All plants across groups" — would need to also have an "All" mode toggle anyway.

**Option C — Filter dropdown.**

```
[Garden]
[Search...]  [↕]  [Group: All ▼]   <-- dropdown picker
─────────────────────────────────────
[ plants ]
```

- Group becomes a refine-dropdown like other Refine filters.
- Pro: minimal new UI surface.
- Con: hidden affordance — Walter persona (low-tech-comfort, "shouldn't have to figure out which menu the thing I want is in") fails. Aria-persona, who has 4-5 groups by spatial location, would tap-drill repeatedly to switch contexts.
- Con: violates REDESIGN §3.4 explicit lock (Zones replace Active Garden / My Plants TABS — both are primary nav surfaces, not refine filters).

**Recommendation: Option A.** Anchored in:
- REDESIGN §3.4 verbatim lock (Zones as primary nav, not filter).
- VISION §8 chrome-control framing: state-bearing chrome (the "you are HERE" indicator) = framed pill toggle pattern, which is exactly what tab rows do.
- Cohesion-by-aggregation anchor: matches Vault sub-tab pattern verbatim — no new primitive introduced.
- Persona walk: all 5 personas pass (Walter sees visible tabs not hidden affordances; Aria's spatial labels become first-class nav; Maya gets fast group-switching; Sydney sees coherent surface; Sam's first group "Garden" stays a single tab).

### 3.2 Group management UI

**Recommendation: dedicated "Manage Groups" screen, accessible from the Garden tab "⋯" overflow menu.**

```
Manage Groups
─────────────
Drag to reorder. Tap to rename.

[≡] Patio              (8 plants)   [Delete]
[≡] Front Yard         (12 plants)  [Delete]
[≡] Bedroom            (3 plants)   [Delete]
[≡] Garden (system)    (0 plants)   [Hidden]

[+ Add Group]
```

- **Create:** "+ Add Group" button at bottom; inline text input with 15-char max.
- **Rename:** tap a group row name → inline-edit.
- **Reorder:** drag handle on left ([≡]).
- **Delete:** "Delete" right-side action — if group has plants, opens confirm sheet with 3 options (per REDESIGN §3.9):
  - **Move plants** → pick another group from dropdown
  - **Unassign** (plants stay in DB, leave group, fall back to default "Garden")
  - **Cancel**
- **System default "Garden"** group: rename + reorder allowed; delete blocked (or treated as auto-hide trigger per REDESIGN §3.4).

**Inline group creation at add-plant time:** AddPlantModal (and the FAB Plant sub-screens) get a "Group" field with autocomplete — typing a new group name shows "+ Create '<name>'" suggestion. Matches REDESIGN §3.4 pattern verbatim. Anchored in [AddPlantModal.tsx](../../src/components/AddPlantModal.tsx) existing tag-autocomplete pattern.

**Tab-bar "+" creation:** when user taps "+" at end of group tab row in Garden tab, opens a small inline input ("Create group name…") + Save / Cancel. New empty group materializes; user can drag plants into it from Manage Groups or by editing plants individually.

**Anchored in:** REDESIGN §3.4 lock; VISION §8 emerald-600 CTA token for "+ Add Group" submit button.

### 3.3 Multi-assignment UX

**When plant is in 2+ groups:** plant card shows no group badge by default (fails REDESIGN §3.5 must-pass test: only 1 of 3 criteria — informational density — without actionable or glance-able value at the card level). Multi-assignment is visible only in:
- Plant detail page (full group chip list)
- Manage Groups (count per group)
- Long-press → "Edit groups" sheet on a plant card

**Counter-option considered: badge per group on the card.** Rejected — competes with VISION §10 "no extra badges per the must-pass test" + degrades scan-ability on dense grids (Maya scenario).

**Anchored in:** REDESIGN §3.5 "must-pass" criteria + VISION §8 chrome-vs-content split (group chips are chrome metadata, not content moments).

### 3.4 Empty states

**Per VISION §8 empty-cell + empty-state body 3-part frame:**

- **No groups, no plants (brand-new user):** No group tabs rendered. Single empty-state card: *"Your Garden Is Empty"* / *"Add a plant or set up a group to organize your garden."* / *"+ Add Plant"* CTA. Anchored in REDESIGN §3.4 + VISION §8.
- **Groups exist, current group empty:** Empty-state card per group: *"Nothing in [Group Name] Yet"* / *"Tap + to add a plant here."* / *"+ Add Plant to [Group Name]"* CTA.
- **Group with no name yet (in-creation flow):** Save button disabled until 1+ char typed; placeholder *"Group name…"*.
- **Em-dash for missing group on plant detail:** If a plant somehow has no group (orphan after migration edge case), detail page shows `Group: —` per VISION §8 empty-cell convention.

**Anchored in:** VISION §8 empty-cell convention + §3.12 #5 ship `9bad88f` empty-state 3-part frame.

### 3.5 Section 3 — Recommendation summary

1. **Garden tab layout: Option A — top-of-page group tabs** (matches Vault sub-tab primitive).
2. **Group management: dedicated Manage Groups screen** from Garden ⋯ overflow + inline at-add-plant-time creation per REDESIGN §3.4.
3. **Multi-assignment: no card badge.** Visible only on detail / Manage / long-press sheet.
4. **Empty states: 3-part frame per VISION §8 + REDESIGN §3.4 copy** — "Your Garden Is Empty" / "Add a plant or set up a group to get started."

**Anchored principle:** VISION §8 design tokens (chrome-vs-content, em-dash, emerald-token-split, casing-split) + REDESIGN §3.4 + VISION §6 Failure Mode 4 cohesion.

---

## 4. FAB menu restructure

### 4.1 Current FAB surface

Per [UniversalAddMenu.tsx:135-203](../../src/components/UniversalAddMenu.tsx:135) — current main screen has 5 chips:

```
[Add]
  ├─ Add Seed Packet
  ├─ Add Plant
  ├─ Add to Shed
  ├─ Add Task
  └─ Add Journal
[Cancel]
```

Sub-screens for `add-plant`: Manual Entry / From Vault / Scan Purchase Order / Photo Import. Sub-screens for `seed`, `shed`, `task`, `journal` are the in-place embedded forms (Path Y refactor).

### 4.2 Current toolbar surface — "+Add Variety" inline button

Per [VaultPageContent.tsx:1034-1042](../../src/app/vault/VaultPageContent.tsx:1034) — inline button sits in the toolbar row next to Filter, Select, and (sometimes) Clear filters.

```tsx
<button onClick={() => setAddVarietyOpen(true)} ...>
  <ICON_MAP.Add className="..." />
  Add Variety
</button>
```

Opens [AddVarietyModal.tsx](../../src/components/AddVarietyModal.tsx) as a standalone modal.

**Cohesion drift this fixes:** every OTHER page in the app routes "add" actions through the FAB. Library is the lone exception. Brief #2 closes this. Anchored in **CLAUDE.md cohesion-by-aggregation principle** + REDESIGN §3.1 FAB structure pattern.

### 4.3 Proposed FAB menu

```
[Add]
  ├─ Add Variety              (NEW — top)
  ├─ Add Seed Packet
  ├─ Add Plant
  │   ├─ Manual Entry
  │   ├─ From Vault
  │   ├─ Scan Purchase Order
  │   └─ Photo Import
  ├─ Add to Shed
  ├─ Add Task
  └─ Add Journal
[Cancel]
```

**6 chips on main screen.** Add Variety placed at top per §1.3 rationale (encyclopedia adds before inventory adds before instance adds before lifecycle layer adds).

**Implementation shape for the §5 plan:**

- Extend `UniversalAddMenuScreen` union ([UniversalAddMenu.tsx:14](../../src/components/UniversalAddMenu.tsx:14)) to include `"variety"` as a new screen value.
- Extend `UniversalAddModal` type ([UniversalAddContext.tsx:5](../../src/contexts/UniversalAddContext.tsx:5)) to include `"variety"` (for the standalone-modal callers like inline FAB if Library page lazy-loads the form, though preferred shape is embedded sub-screen).
- New main-screen chip pointing to `setScreen("variety")`.
- New screen branch for `"variety"` — embeds AddVarietyForm (extracted from AddVarietyModal as a named export, mirroring TaskForm / JournalEntryForm / SupplyForm / SeedPacketForm extraction pattern locked 2026-05-20 `bee5338` Path Y refactor).
- Drop the inline "Add Variety" button from [VaultPageContent.tsx:1034-1042](../../src/app/vault/VaultPageContent.tsx:1034) (or in the same chapter, from the new Plants tab toolbar — since Library moves out of Vault per move #1, the button-drop happens at the new location).
- Keep AddVarietyModal as a standalone mountable component for non-FAB callers (none today; potential future deep-links).

**Shared options across menus — locked: shared options occupy same relative position across all FAB add menus.**

Current shared sub-screen options (Photo Import / Manual Entry / Purchase Order):
- Add Plant sub-screen has: Manual Entry → From Vault → Scan Purchase Order → Photo Import
- Add Seed Packet (in-menu form) has its own internal flow with Photo Import + Purchase Order entry points via header chips

**Cohesion-by-aggregation finding:** Photo Import sits in different relative positions across Add Plant vs Add Seed Packet vs (future) Add Variety. The brief locks: shared options occupy same relative position. **Recommendation: standardize as Manual Entry → Photo Import → Purchase Order order across all add-X sub-screens that have them.** Each add-X sub-screen omits options that don't apply (e.g. Add Variety likely has Manual Entry + Photo Import but no Purchase Order; Add to Shed has Photo Import + Purchase Order but the form-based add is primary). Documented as a Pass 3 sibling-sweep finding for the implementation chapter.

**Anchored in:** brief #2 lock + REDESIGN §3.1 FAB structure + CLAUDE.md cohesion-by-aggregation rule + VISION §8 component reuse principle.

### 4.4 Section 4 — Recommendation summary

1. **Add Variety as new top-level FAB chip** (top of menu, before Add Seed Packet).
2. **Extract AddVarietyForm** from AddVarietyModal (named export pattern, mirrors Path Y form-extraction lock).
3. **Drop inline "+Add Variety"** from Library toolbar (now on the new Plants tab post-move-#1).
4. **Lock shared-option ordering** across all add-X sub-screens: Manual Entry → Photo Import → Purchase Order. Each menu omits inapplicable options.

**Anchored principle:** brief #2 lock + REDESIGN §3.1 + CLAUDE.md cohesion-by-aggregation + Path Y form-extraction lock.

---

## 5. Migration / cutover plan

### 5.1 Recommended chunking — 2 bundled ships, not 4 separate ones, not 1 massive one

**Recommendation: 2-ship phasing.**

| Ship | Scope | Effort | Risk |
|---|---|---|---|
| **Ship A — Plants tab + FAB consistency (moves #1+#2)** | Lift Library from Vault → new top-level `/plants` route; Vault collapses to Packets+Shed; Bottom nav goes 5→6 tabs; Add Variety FAB chip + Path Y form-extraction; inline button removed | M-ish (~10-12h) | Low — pure UI restructure, no schema, no data migration. Tests + route migrations. |
| **Ship B — Garden merge + Groups (moves #3+#4)** | Active Garden + My Plants merge per existing merge plan; new `groups` + `plant_groups` tables; auto-create + auto-assign migration; Manage Groups UI; Garden tab group nav; inline group creation at add-plant-time | L (~15-20h) | Medium-high — DB migration on prod, M-N data model, multi-surface UI change, onboarding tooltip, RLS validation, deep-link migrations from `?tab=active|plants` |

**Why 2 ships, not 1:**
- Ship A has zero data-migration risk; ships fast, lets Syd dogfood the 6-tab navigation independently of the bigger move. If 6-tabs feels wrong on phone widths, learn that BEFORE we sink Ship B time into a structure built on top.
- Ship B carries the M-N data model + migration + persona-walk UX work. Bundling Ship A's risk into Ship B's prod migration push compounds blast radius.
- Per CLAUDE.md push-tier discipline: smaller coherent ships > one massive ship.

**Why 2 ships, not 4:**
- Moves #1+#2 share toolbar surface; can't ship #1 without resolving where Add Variety goes (and shipping #2 without #1 leaves Add Variety on a Library tab about to disappear).
- Moves #3+#4 are the same decision (per §0).

**Counter-option: one bundled ship.** Rejected — too large for one prod push; rolls 2 distinct user-mental-model shifts together. If something breaks, root-causing becomes harder.

**Counter-option: 3-ship (move #1 + #2 + #3+#4).** Move #2 by itself doesn't make sense — drops the Library toolbar button and replaces with FAB chip while Library is still inside Vault, then the next ship moves Library out and the FAB chip routes to a different tab. Double-the-disruption for no benefit.

### 5.2 Ship sequencing — within each ship

#### Ship A — Plants tab + FAB consistency

1. **Pre-migration:** plan + 4-pass audit per CLAUDE.md plan-audit standard.
2. **Code changes:**
   - Add `"/plants"` route at `src/app/plants/page.tsx` — lift Library rendering shell from VaultPageContent.
   - Extract Library rendering pieces from VaultPageContent into reusable component (`VaultLibraryWing` peer of existing `VaultPacketWing` + `VaultShedWing`).
   - Update [navItems.tsx:111-117](../../src/components/navItems.tsx:111) — add Plants item, reorder to `Home / Garden / Plants / Vault / Calendar / Journal`. New icon for Plants (Lucide `Sprout` candidate; or reuse existing `PlantPlaceholderIcon` — anchor decision at impl time).
   - VaultPageContent drops `viewMode === "grid"` branch + drops the inline Add Variety button.
   - URL redirects: `/vault?tab=grid` → `/plants` (router.replace on mount); `/vault?tab=list` keeps default; legacy detail `/vault/[id]` stays.
   - UniversalAddMenu: extend `UniversalAddMenuScreen`, add `"variety"` branch, extract `AddVarietyForm` from `AddVarietyModal`.
   - Update FAB chip ordering on main screen.
3. **Tests:** route smoke test for `/plants`; Library functionality regression test (existing tests stay valid since the component moves but the behavior doesn't); FAB Add Variety smoke test; deep-link redirect test.
4. **Verification:** `npm run build` + `npm run test:run` clean. Per chat HARD-RULE pattern (recent commits) — NO Preview MCP — tests + build + git diff sufficient; Syd dogfood verifies visual on prod.

#### Ship B — Garden merge + Groups

1. **Pre-migration:** plan + 4-pass audit + REDESIGN §3.4 + §3.10 doc edits + existing merge plan re-audit.
2. **Schema migration:** additive idempotent SQL (code-tier per CLAUDE.md SQL migrations subsection) — `groups` + `plant_groups` tables + RLS policies + indexes + onboarding-tooltip flag column on `user_settings`.
3. **Data migration:** auto-create + auto-assign per §2.4 SQL. Idempotent (`ON CONFLICT DO NOTHING`). Wrapped in a single migration file.
4. **Code changes:**
   - `src/app/garden/page.tsx` per existing merge plan §3: collapse dual state trees → single state tree; new `GroupTabs` component (replaces the existing `activeFilters` / `plantsFilters` 2-tab toggle); render single body filtered by selected group.
   - `ActiveGardenView` + `MyPlantsView` either fully merge into one `GardenView` component, OR stay as presentational shells that the page composes based on group filter. Per existing merge plan recommendation: keep as presentational components (each lifecycle still has different summary fields per `GrowingBatch` vs `PermanentPlanting` row shapes; the merge happens at page-state level, not row-render level). HOWEVER: with groups replacing the lifecycle-split, the rationale for two row shapes weakens — RECOMMENDATION FOR §5: unify the row component as part of Ship B since user organization is now by group not by lifecycle. This is the biggest internal refactor inside Ship B and warrants its own audit pass.
   - New `ManageGroupsScreen` component + route (`/garden/groups` OR modal — recommendation: modal sheet via FAB-tree-style sub-screen, anchored in Path Y pattern).
   - New `GroupTabs` component for top-of-page group nav, reusing the Vault sub-tab primitive at [VaultPageContent.tsx:990+](../../src/app/vault/VaultPageContent.tsx:990).
   - URL migration: `/garden?tab=active` → `/garden?group=garden` (or `?group=permanent`); `/garden?tab=plants` → `/garden?group=permanent`. One-time redirect on mount.
   - sessionStorage migration: keys `garden-active-sort` + `garden-plants-sort` → unified `garden-sort` per existing merge plan §3.
   - AddPlantModal gets a "Group" autocomplete field with inline-create flow.
   - One-time onboarding tooltip on first login post-migration.
   - REDESIGN_2026-05-18.md doc edit: Zones → Groups per §2.1 reconciliation.
5. **Tests:** new `groups.regression.test.ts` (CRUD, RLS, soft-delete); `plant_groups.regression.test.ts` (M-N join, multi-assignment, ON CONFLICT idempotency); existing merge plan's `mergedGroupTabBehavior.regression.test.ts` (URL ↔ state, deep-link precedence, sessionStorage migration); migration smoke tests (auto-create + auto-assign).
6. **Verification:** tests + build clean; migration applied to remote via `supabase db push --linked` (additive idempotent code-tier, standard "yes build" greenlight per CLAUDE.md SQL subsection); NO Preview MCP per chat HARD RULE; Syd dogfood on prod.

### 5.3 Deep-link / route redirect inventory

| Legacy URL | Lands at (post-migration) | Implementation |
|---|---|---|
| `/vault?tab=grid` | `/plants` | `router.replace("/plants")` on VaultPageContent mount if `?tab=grid` |
| `/vault?tab=list` | `/vault?tab=packets` (rename) OR keep `/vault?tab=list` | Decision: keep both labels working; canonical = `?tab=packets`. Legacy `?tab=list` redirects. |
| `/vault?tab=shed` | unchanged | — |
| `/vault/[id]` | unchanged (stays canonical) | — |
| `/garden?tab=active` | `/garden?group=garden` | `router.replace` on garden/page.tsx mount per existing merge plan |
| `/garden?tab=plants` | `/garden?group=permanent` | Same |
| `/garden?profile=<id>` | `/garden` filtered to relevant group(s) | Auto-resolve from profile's lifecycle_pattern (or 'Garden' default) |
| `/garden?grow=<id>` | `/garden?group=<id-of-plants-group>` | Auto-resolve from plant_groups row |

**Calendar `/schedule` cross-link unchanged. Settings paths unchanged.** Sidebar nav ([Sidebar.tsx](../../src/components/Sidebar.tsx) per ROADMAP §1) needs the new `/plants` item AND order update.

### 5.4 E2E test rewrites required

Per CLAUDE.md Pass 3 E2E-scope sub-rule (2026-05-27 lock): grep `e2e/` for visible labels that change.

- `e2e/*.spec.ts` files that reference "Active Garden" / "My Plants" → rename to "All" or "Garden" or specific group test fixtures (need impl-time grep + audit).
- `e2e/*.spec.ts` that test the Library tab via `?tab=grid` → update to `/plants`.
- `e2e/*.spec.ts` that test the Add Variety inline button → update to FAB-driven flow.
- New e2e flow: create group → assign plant → switch group tab → confirm visibility.

### 5.5 Backwards-compat considerations

- **Bookmarks** to `/vault?tab=grid` (likely Syd + sister) → redirect via mount-time `router.replace`. Land for ≥1 release before removing the legacy code path.
- **Mid-flight onboarding** users (haven't completed setup) → migration auto-creates "Garden" group but they have no plants; tooltip skipped if no plants exist.
- **Household members** — both members' grow_instances get assigned to their respective owner's groups. Cross-member visibility for trades stays unchanged (separate concern from groups).
- **Test users / dev gating** — synthetic user fixtures regenerate with groups assigned per migration.

### 5.6 Pre-ship persona walk plan

Per CLAUDE.md plan-audit Pass 2 persona walk + PERSONAS.md cross-persona scan, run BEFORE Ship B code lands:

| Persona | Pre-ship check |
|---|---|
| **Maya** | Does multi-grouping (M-N) let her track "Patio + Companion-planted with basil + Seed-saving target" axes independently? Does Manage Groups bulk operation perform on 30+ plants? |
| **Sydney** | Are renamed labels coherent app-wide post-ship? Does the merge-experience-into-groups feel less "lost" than today's Active Garden / My Plants split? |
| **Walter** | Are group tabs tap-only (no swipe-required)? Is Manage Groups accessible from a visible button (not hidden gesture)? Are 44×44 tap targets on group-tab pills? |
| **Aria** | Does her "Living Room / Bedroom / Office" group set make sense in the Garden tab name? (Garden as the tab name might still feel outdoor-flavored even with custom groups — consider future rename to "My Plants" or "Plants" tab — but parked, see §6.) |
| **Sam** | Does brand-new-user empty-state guide her? Does migration tooltip skip if no plants? Are groups optional (can she skip the feature entirely)? |

**Anchored in:** PERSONAS.md cross-persona scan + REDESIGN §3.5 must-pass criteria.

### 5.7 Section 5 — Recommendation summary

1. **2-ship phasing: Ship A (moves #1+#2) first, Ship B (moves #3+#4) second.**
2. **Ship A scope:** Plants top-level tab + Vault collapses to Packets+Shed + Add Variety FAB chip + Path Y form-extraction.
3. **Ship B scope:** Garden merge + Groups schema + migration + Manage Groups UI + group nav + inline create + onboarding tooltip.
4. **URL migration map** per §5.3.
5. **E2E rewrites** required per §5.4.
6. **Persona walk** before Ship B code lands per §5.6.

**Anchored principle:** CLAUDE.md plan-audit + push-tier safety + SQL migration tier + cohesion-by-aggregation + Pass 3 E2E-scope sub-rule + persona walk standard.

---

## 6. Risks + open questions

### 6.1 Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| **6-tab bottom nav too cramped at phone widths < 412px** | Med | Responsive icon-only label per brief; verify on Syd's actual phone width pre-ship. If cramped, fallback = icons-only at all phone widths, labels only at tablet+. |
| **Lifting Library out of Vault breaks deep-links** | Med | Mount-time `router.replace` on `/vault?tab=grid`; land for 2+ releases before removing the legacy path. |
| **Plants tab vs Vault overlap confuses users** | Low-Med | Empty-state + tooltip on first session post-ship explaining the split. Tab labels + tab icons should differentiate clearly (Plants = sprout icon; Vault = grid/box icon — current VaultIcon stays for Vault). |
| **M-N groups migration produces orphan plant_groups rows** | Low | `ON CONFLICT (grow_instance_id, group_id) DO NOTHING` + idempotent re-runnability + CASCADE FK on grow_instance_id ensures cleanup on grow delete. |
| **Existing free-text `grow_instances.location` becomes redundant with groups** | Med | Keep `location` as denormalized display string (existing chip in ActiveGardenView). Future polish chapter prompts users to convert location strings to groups via guided UI. Don't try to auto-map "back bed" → group; user-domain knowledge required. |
| **Household-shared groups confusion** | Med (delayed) | v1 = per-user groups. v1.1 surfaces household-shared groups if dogfood reveals coordination friction. Anchored in VISION §3 Layer 2 "Acts as shared identity by default." |
| **"Garden" tab name conflicts with the renamed "My Plants" mental model when user is indoor-only (Aria)** | Med | Open Q1 — see §6.2. |
| **REDESIGN §3.13 lifecycle_pattern + groups landing in different ships could cause stale data** | Low | Sequential ship order (groups Ship B first; lifecycle_pattern Ship C later per REDESIGN Ship 5). `is_permanent_planting` stays read-only between ships. |
| **Cohesion-by-aggregation drift** — group-tab pill primitive vs Vault-sub-tab pill primitive could drift in style if not anchored verbatim | Med | Pass 3 sibling sweep in Ship B impl audit must cite [VaultPageContent.tsx:990+](../../src/app/vault/VaultPageContent.tsx:990) as anchor; reuse the JSX shape verbatim. |
| **AddPlantModal becomes over-burdened with field count (lifecycle toggle + group autocomplete + ...)** | Low | Groups field is optional; defaults to current default group ("Garden" or last-used). |
| **Path Y form-extraction for AddVarietyForm clashes with AddVarietyModal's enrichment side-effects** | Low | Mirror exact extraction pattern from `TaskForm` etc. — enrichment fires on `handleSubmit` resolution per [AddVarietyModal.tsx:42+](../../src/components/AddVarietyModal.tsx:42). |

### 6.2 Open questions for Syd to lock before implementation chapter spawns

> Questions are ranked by load-bearing impact. Recommendation noted on each.

**Q1 — Terminology lock: "Groups" or "Zones"?**

The brief uses "Groups"; REDESIGN_2026-05-18 §3.4 uses "Zones." Adopting "Groups" requires editing REDESIGN_2026-05-18.md cross-refs in the IA chapter (small doc-edit, contained).

- **(A) Groups (Recommended).** Adopt brief lock; rename REDESIGN cross-refs. Avoids USDA-zone namespace collision; matches brief's example labels ("Patio" / "Bedroom") which sound non-zone-flavored. Persona walk: Walter + Aria + Sam see less confusion.
- (B) Zones. Keep REDESIGN's earlier lock; garden-domain flavor. Risk: USDA zone collision.

**Recommend (A).** Anchored in PERSONAS.md cross-persona walk + CLAUDE.md authority precedence (2026-05-28 > 2026-05-18).

**Q2 — Garden tab name for indoor-only users (Aria persona): keep "Garden" or rename to "Plants" / "My Plants"?**

If Garden tab name reads outdoor-only, Aria's user-defined groups ("Bedroom" / "Office") feel jarring under it.

- **(A) Keep "Garden" (Recommended).** Brief locks "Garden" as the merged tab name. Aria's empty-state copy is the right place to neutralize ("Add a plant or set up a group to organize your space") — same approach VISION §3 takes for Aria already.
- (B) Rename to "My Plants" — disambiguates encyclopedia (Plants) from instances (My Plants).
- (C) Rename to "Plants" — but conflicts with the encyclopedia tab name in this chapter.

**Recommend (A).** Anchored in brief #3 explicit lock + REDESIGN §3.4 "Garden" system default zone alignment. Cost of B/C: collision with the encyclopedia tab name; ripple through deep-links + sidebar nav.

**Q3 — Ship phasing: 2 ships (A+B per §5.1) or 1 bundled?**

- **(A) 2 ships (Recommended).** Ship A first (move #1+#2, low risk). Ship B second (move #3+#4, M-N data layer + migration). Smaller blast radius per push; lets Syd dogfood 6-tab nav independently.
- (B) 1 bundled. Faster end-state but compounds risk.

**Recommend (A).** Anchored in CLAUDE.md push-tier discipline + SQL migration tier safety.

**Q4 — Multi-assignment visual treatment on plant cards: badge or no badge?**

- **(A) No badge (Recommended).** Multi-assignment visible only on detail / Manage Groups / long-press sheet. Card stays clean.
- (B) Badge per group. Risks: card overwhelm at Maya's scale; competes with family-mode badges (REDESIGN §3.5 "must-pass" violation).

**Recommend (A).** Anchored in REDESIGN §3.5 must-pass criteria + VISION §8 chrome-vs-content.

**Q5 — Move detail routes (`/vault/[id]`) to `/plants/[id]` in this chapter, or defer?**

- **(A) Defer (Recommended).** Keep `/vault/[id]` canonical for now; just the list view moves to `/plants`. Detail-route rename is a separate cohesion chapter touching 30+ deep-link references.
- (B) Move now. Cohesion benefit; bigger blast radius.

**Recommend (A).** Anchored in CLAUDE.md push-tier discipline + 30+ deep-link change cost.

### 6.3 Section 6 — Recommendation summary

1. Risk register identifies 11 risks with mitigations; biggest is 6-tab phone-width cramp (med severity, mitigated via responsive design) and AddPlantModal field-burden (low, mitigated via optional group field).
2. 5 open questions for Syd to lock; recommendations marked. Q1 + Q3 are the load-bearing ones (terminology + phasing).

**Anchored principle:** CLAUDE.md plan-audit Pass 2 concerns-hunt + PERSONAS.md cross-persona walk + REDESIGN must-pass criteria.

---

## 7. Scope estimate

### 7.1 Ship A — Plants tab + FAB consistency

| Task | Effort |
|---|---|
| Plan + 4-pass audit | ~2h |
| `/plants` route + extract `VaultLibraryWing` | ~3h |
| Bottom nav 5→6 tabs + new icon + responsive treatment | ~1.5h |
| VaultPageContent drop `viewMode === "grid"` + drop inline Add Variety button | ~1h |
| FAB: extend `UniversalAddMenuScreen` + `AddVarietyForm` extraction + new chip + lock shared-option ordering | ~2h |
| URL redirect migration (legacy `?tab=grid` → `/plants`) | ~0.5h |
| Tests (new route, FAB chip, redirect) | ~1.5h |
| Manual dogfood verification on prod | ~30 min (Syd) |
| **Total Ship A** | **~10-12h build time (~M-size)** |

### 7.2 Ship B — Garden merge + Groups

| Task | Effort |
|---|---|
| Plan + 4-pass audit + REDESIGN doc edits | ~3h |
| Schema migration (groups + plant_groups + RLS + indexes) | ~1.5h |
| Data migration (auto-create + auto-assign) | ~1.5h |
| garden/page.tsx state-tree collapse per existing merge plan | ~4h |
| GroupTabs component (reusing Vault sub-tab primitive) | ~2h |
| Manage Groups screen (modal sheet via Path Y pattern) | ~3h |
| Inline group-create at add-plant-time | ~2h |
| AddPlantModal "Group" autocomplete field | ~2h |
| URL migration (`?tab=active|plants` → `?group=...`) | ~1h |
| sessionStorage migration (per existing merge plan) | ~0.5h |
| Onboarding tooltip on first login post-migration | ~1h |
| Tests (groups CRUD, plant_groups M-N, merged garden behavior, migration smoke) | ~3h |
| REDESIGN_2026-05-18.md doc edit (Zones → Groups) | ~0.5h |
| Manual dogfood verification on prod | ~1h (Syd) |
| **Total Ship B** | **~25-30h build time (~L-size)** |

### 7.3 Combined estimate

**~35-42h total** across both ships. Two chapters; sequential.

**Breakpoint between ships: Ship A merges + dogfooded clean for ≥1 day before Ship B starts.** Per CLAUDE.md ship-discipline — atomic ships + interval for dogfood before next chunk lands.

### 7.4 What this estimate does NOT include

- Phase 2 stage-as-UI work (deferred per REDESIGN §3.5).
- Phase 3 multi-zone Schedule rebuild (deferred per VISION §11).
- REDESIGN Ship 5 plant profile redesign (separate L-size effort).
- Household-shared groups v1.1 (parked per §6.1).
- Detail-route rename `/vault/[id]` → `/plants/[id]` (deferred per Q5 recommendation).

### 7.5 Section 7 — Recommendation summary

1. **Ship A: ~10-12h (M).** Ship B: ~25-30h (L). Total ~35-42h.
2. **Sequential, not parallel** — Ship A's 6-tab nav needs Syd dogfood before Ship B builds on top.
3. **Out-of-scope deferrals named** so the IA chapter doesn't scope-creep.

**Anchored principle:** CLAUDE.md ship discipline + counter-creep guard (out-of-scope explicitly enumerated).

---

## 8. Where this plan ends

This is a planning doc, not a kickoff. Before any code lands:
1. Syd reviews this doc.
2. Locks Q1-Q5 (or accepts recommendations).
3. Greenlights Ship A as the first implementation chapter to spawn.
4. Ship A runs Phase 2 readiness gate (full plan-file at `.claude/plans/<branch>.md`, 4 audit pass-types iterative-until-clean) before any code edit.
5. Ship A dogfooded ≥1 day on prod.
6. Ship B kickoff.

**Status at hand-off:** plan doc complete; awaiting Syd's Q1-Q5 locks + ship-A greenlight to advance into Phase 2 of the implementation chapter.
