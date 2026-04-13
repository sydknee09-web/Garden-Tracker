# Post–v1.0 Execution Roadmap

**Purpose:** Turn the 40-item [HEALTH_AND_IMPROVEMENTS.md](HEALTH_AND_IMPROVEMENTS.md) into a high-velocity execution script Cursor can follow without losing the Sanctuary soul or breaking the data layer.

**Rule:** No amount of visual polish may precede structural integrity. The Golden Four are gatekeepers.

---

## 1. Golden Four (Gatekeepers)

**Items 1–4** are the only gatekeepers:

| # | Item | Meaning |
|---|------|--------|
| 1 | First Blockage RPC | Implement Highest Incomplete Ancestor in `get_packable_candidates` (see § 2). |
| 2 | RLS verification | Run two-account tests per [RLS_VERIFICATION](RLS_VERIFICATION.md); document in [TESTING_CHECKLIST](TESTING_CHECKLIST.md). |
| 3 | Satchel new-user verify | Manual test: fresh UID → 6 empty slots → Pack; document in TEST_STRATEGY / TESTING_CHECKLIST. |
| 4 | Error boundaries | Themed `SanctuaryErrorWidget` replacing the red screen (see Plan of Attack Phase II). |

**Do not start Accessibility (21) or Aesthetics (27)** until items **1** and **2** are signed off. Those two are the only items that can cause **data-integrity** failure.

---

## 2. First Blockage: Naive vs Gatekeeper RPC

Cursor must understand: any fix that bypasses the **Highest Incomplete Ancestor** violates a core design principle.

### Naive RPC (current limitation)

- **Behavior:** Gates on the *first incomplete top-level boulder* only (`nlevel(path) = 2`).
- **Problem:** When that boulder is completed, its **entire subtree** is skipped. Incomplete sub-boulders (e.g. Kitchen → Organize Pantry) never get their leaves exposed to Pack.
- **Result:** Users get stuck—no packable candidates even though work remains.

### Gatekeeper RPC (First Blockage)

- **Behavior:** Finds the **First Blockage** in a depth-first, first-child-first journey: the first node with `is_complete = false` becomes the root for the “unlocked” set. Recursion descends from that node to leaves.
- **Result:** Nested boulders (Office → Desk → Drawers) unlock correctly. When Office is done, Kitchen unlocks; when Kitchen’s first incomplete sub-boulder is found, its leaves become packable.

### Where the blockage sits (tree diagram)

```
Mountain: "Organize House"
│
├── Office (complete)          ← Naive RPC stops here; subtree skipped
│   ├── Desk (complete)
│   └── Drawers (complete)
│
├── Kitchen (incomplete)       ← NAIVE: would gate here at top level only
│   ├── Clean Fridge (complete)
│   └── Organize Pantry (incomplete)   ← GATEKEEPER: first incomplete in depth-first order
│       ├── Shelf A (leaf, incomplete) ← Packable under Gatekeeper
│       └── Shelf B (leaf, incomplete) ← Packable under Gatekeeper
│
└── Sanctuary (incomplete)
    └── ...
```

**Naive:** Only top-level “Kitchen” is the gate; if we ever gated by “first incomplete at level 2” and then recursed, we’d still miss sub-boulders. The current implementation gates at a **fixed** level and does not descend to “Organize Pantry.”

**Gatekeeper:** First-Child-First traversal. First node with `is_complete = false` = **Organize Pantry**. That node is the root for the unlocked CTE; its leaves (Shelf A, Shelf B) are packable.

**Implementation:** Refactor per [VALIDITY_FILTER_RPC_SPEC.md](VALIDITY_FILTER_RPC_SPEC.md) § Planned Refactor (Highest Incomplete Ancestor). Create a **new migration file**—do not edit the existing RPC migration in place. Use the filename `20250320000004_first_blockage_refactor.sql` to keep Supabase history clean (000003 is used by get_peak_progress_rpc). Then run in Supabase. Survey layout is unchanged (all leaves under peak remain open).

---

## 3. Strategic Clusters (Cursor Instructions)

### Cluster A — “Tactile Keyboard” (Items 6 & 13)

**Single instruction for Cursor:**

> In [climb_flow_overlay.dart](lib/features/scroll_map/climb_flow_overlay.dart), implement Step Descriptions for each wizard stage. Additionally, for Step 5, ensure the TextField focus is never lost after tapping "Place Pebble" so I can enter multiple tasks rapidly without the keyboard dismissing.

### Cluster B — “Visual Sophistication” (Items 7, 9, 27)

The amber tint must be an **environmental effect**, not a static style. Wire period first; then apply tint only when the period is Night.

**Instruction for Cursor:**

> Apply the following visual refinements:
>
> **Entry animations:** Add a 1.5 letter-spacing animation to “THE MAP” and “YOUR SATCHEL” headers on entry; add a typewriter reveal to Elias’s wizard dialogue.
>
> **Conditional aesthetics:** Wire **ScenePeriod** (or your time provider) to the Refine and Whetstone overlays. **Only if the current ScenePeriod is Night**, apply a subtle amber tint to these surfaces to match the Sanctuary’s evening atmosphere.

**Refine wiring:** [edit_flow_overlay.dart](lib/features/scroll_map/edit_flow_overlay.dart) must consume ScenePeriod (or the app’s time provider); if it does not yet have access, add it so the tint is driven by environment, not a hard-coded style.

**File touchpoints:** [whetstone_choice_overlay.dart](lib/features/satchel/whetstone_choice_overlay.dart), [edit_flow_overlay.dart](lib/features/scroll_map/edit_flow_overlay.dart) (Refine parchment), [scroll_map_screen.dart](lib/features/scroll_map/scroll_map_screen.dart) and [satchel_screen.dart](lib/features/satchel/satchel_screen.dart) (headers), [climb_flow_overlay.dart](lib/features/scroll_map/climb_flow_overlay.dart) (Elias lines).

---

## 4. High-Impact Callouts

### 4.1 Item 21 — “Ghost in the Machine” (Semantics / Hidden Quality)

Accessibility here is **hidden quality**: the app should feel intentional to assistive tech users without changing the visible UI.

**Instructions for Cursor:**

- Ensure **HearthSparkPainter** is wrapped in **ExcludeSemantics** (or the widget that hosts it uses `excludeFromSemantics: true`). Decorative sparks must not be announced.
- The **“Pack this Journey”** (Pack) button must have a **Semantics** label that describes the state, e.g. *“Pack 4 pebbles into your satchel.”*
- Similarly, **Burn** and other key actions (New Journey, Hammer, Whetstone tile, Elias speech bubbles) should have descriptive labels so TalkBack/VoiceOver users understand state and next action.

### 4.2 Item 30 — Satchel Pack Animation (Fly Logic)

- Use an **Overlay** or top-level **Stack** so stones can animate across screens if the user navigates during the fly. See [SATCHEL_PACK_ANIMATION_SPEC.md](SATCHEL_PACK_ANIMATION_SPEC.md).
- **Performance (critical):** Wrap the **moving stone** in a **RepaintBoundary**. Without it, the entire SanctuaryScreen repaints every frame; with it, only the stone’s layer repaints. This is the difference between ~30fps and 60fps on mid-range Android.

### 4.3 Item 33 — “The Pulse of the Sanctuary” (Waiting State)

Do not document this as a generic “loading screen.” Frame it as **the pulse of the Sanctuary**.

- **Copy:** Use “Waiting” (or equivalent) rather than “Empty” where the state is “data not yet loaded” or “no items yet.”
- **Loading state:** The “Waiting” state (dimmed HearthSparkPainter) should be **standardized across Scroll, Satchel, Whetstone, and Archive screens** to replace generic loading indicators. The dimmed painter should use a **slower `sparkTime`** than the active one—it signals “the app is thinking” without breaking the campfire metaphor.
- **Implementation note:** Use **sparkTime × 0.3** for the Waiting state (and AnimatedOpacity 0.4 for the dimmed painter). Do not do a full loading pass; add only when touching that screen for another reason (e.g. satchel_screen for animations).

---

## 5. GPU Danger Zone & Revert Protocol

**Danger zone:** Items 29 (Elias idle), 32 (Parallax), and 30 (Satchel pack) together can push mid-range Android below 60fps.

- **Rule:** Use `const` constructors for static background layers.

**Sequential performance gate:** Item 30 (Satchel Pack Animation) is the highest GPU consumer. **Immediately after implementing Item 30**, perform a 60fps check on a mid-range device. If the frame rate drops during the “stone fly” transition, you **must** implement **Item 17 (Narrow Invalidation)** before proceeding to Phase 12 animations (Elias idle, parallax). Do not tune the animation first—address invalidation scope.

### Revert Protocol

**If any animation (e.g. Satchel Pack) causes a performance drop below 55fps:**

1. **Stop.** Do not optimize the animation’s math. **Immediate pivot:** Implement or tighten **Narrow Invalidation (Item 17)**—invalidate only the affected mountain’s node list (e.g. after `_saveTitle`) instead of global invalidation.
2. **Then** consider simplifying or deferring the animation. If you see stutter on a mid-range device (e.g. S918U) during the stone fly, treat that as the threshold: go straight to Item 17.

---

## 6. Plan of Attack — Chain of Trust

Execute in order. Do not skip steps or start a later step before the previous one is done.

| Step | Phase | Action |
|------|-------|--------|
| **1** | **The RPC** | Implement First Blockage as a **new migration** (`20250320000004_first_blockage_refactor.sql`). Run in Supabase. |
| **2** | **Safety pass** | 1) Implement Error Boundaries (4)—themed **SanctuaryErrorWidget**. 2) Complete RLS Verification (2); document in TESTING_CHECKLIST. 3) **Manual test: Fresh-UID Satchel Seeding**—confirm 6 empty slots appear for new users; document in TEST_STRATEGY / TESTING_CHECKLIST. This confirms seeding logic, not just “a check.” |
| **3** | **Vibe pass** | Execute Cluster A (Tactile Keyboard) from § 3, then Cluster B (Visual Sophistication) from § 3. |

**Green light before Step 1:** Run `flutter analyze lib/` once; expect no issues.

---

## 7. References

- [HEALTH_AND_IMPROVEMENTS.md](HEALTH_AND_IMPROVEMENTS.md) — Full 40-item list, priority overview, quick reference.
- [VALIDITY_FILTER_RPC_SPEC.md](VALIDITY_FILTER_RPC_SPEC.md) — First Blockage (Highest Incomplete Ancestor) spec and SQL notes.
- [SATCHEL_PACK_ANIMATION_SPEC.md](SATCHEL_PACK_ANIMATION_SPEC.md) — Pack fly animation spec.
- [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) — First Five table, RLS and Satchel verification documentation.
