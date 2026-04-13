# Rune Terminology & Visualization — Audit Report

**Date:** March 2026  
**Scope:** MASTER_PLAN.md + all linked docs, aligned with Rune concept (MASTER_PLAN § Logic & Leaf Protocol → Rune Terminology & Visualization)  
**Status:** Planned. Not yet implemented.

---

## 1. Questions & Concerns (Pre-Implementation)

### Questions for Product Owner

| # | Question | Options |
|---|----------|---------|
| 1 | **Primary vs supplemental term?** | A) "Rune pebble" as primary label in UI. B) "Pebble" remains primary; "rune" used only in Elias/lore. |
| 2 | **Elias dialogue density?** | How often should Elias say "rune"? Every burn ("Offer your rune stone to the fire") vs occasional ("The rune stones feed the flame")? |
| 3 | **Rune visual distinctiveness?** | How different from non-rune? Subtle (glow, glyph) vs strong (different shape, rune markings)? |

### Concerns (Mitigation)

| # | Concern | Mitigation |
|---|---------|------------|
| 1 | **Terminology proliferation** — "rune boulder, rune pebble, rune shard" adds 3 terms. | Use "rune stone" as umbrella in Elias; reserve "rune boulder/pebble/shard" for Map/Detail where hierarchy is visible. |
| 2 | **Consistency** — If rune in UI, must be consistent (pack, burn, satchel, map). | Audit all user-facing strings; add rune to terminology checklist. |
| 3 | **Containers** — Non-rune visuals must be clearly distinct so users don't try to pack them. | Design spec: rune = packable cue (e.g. rune glyph, warm glow); container = muted, no rune mark. |

---

## 2. Summary of Rune Concept

| Rule | Description |
|------|-------------|
| **Rune = packable** | Rune Boulder, Rune Pebble, Rune Shard = leaf nodes that go in the Satchel. |
| **Non-rune = container** | Boulders with pebbles, pebbles with shards = landmarks; different visual. |
| **Distinct visualization** | Rune items use rune stone style so users connect "this burns." |
| **Theme** | Lighting the fire with rune stones. |

---

## 3. Documents Requiring Updates

### 3.1 CRITICAL — Core Specs

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **MASTER_PLAN** | North Star, line 37 | "burning a pebble, packing a stone" | Add: *Rune: packable items = rune stones (rune boulder, rune pebble, rune shard).* |
| **MASTER_PLAN** | §2 Weight of Satchel | "Stones flying into bag" | Add: *Rune stones* for consistency. |
| **NAVIGATION_MAP** | Satchel, Hearth | "stones," "stone" | Add: *Rune stones* where packable/burnable. |
| **SATCHEL_PACK_ANIMATION_SPEC** | §1 Origin, §5 Lore | "Stones," "stones" | Add: *Rune stones* — packable leaves with rune visual. |

### 3.2 HIGH — Elias Dialogue

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **ELIAS_DIALOGUE_REFERENCE** | After Burn, Pack, etc. | "stone," "stones" | Add rune variants or note: *Rune: use "rune stone" when referring to burnable items.* |
| **elias_dialogue.dart** | (code) | `_afterBurn`, `_afterPack`, etc. | Add rune-aware lines or extend pools. |
| **ELIAS_INTRODUCTION_SPEC** | Intro beats | "stones," "Satchel" | Add: *Rune stones* in Satchel/Hearth beats. |

### 3.3 HIGH — Hammer & Refine

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **HAMMER_REFINE_MODAL_SPEC** | §2, §4 | "Stone," "stone" | Add: *Rune: Shattering creates rune pebbles (or rune shards).* |
| **MASTER_PLAN** | Part B 2.1 | "Stone (boulder)" | Add: *Rune: Packable = rune stone.* |

### 3.4 MEDIUM — Map, Progress, UI

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **PEAK_JOURNAL_SPEC** | Tree, Progress | "Boulders," "Pebbles" | Add: *Rune: Packable nodes use rune visual.* |
| **NAVIGATION_MAP** | §6 Mallet, Trail | "Pebble," "Shard" | Add: *Rune: Leaf nodes = rune visual.* |
| **ASSET_INVENTORY** | (if exists) | — | Add: Rune stone assets (boulder, pebble, shard variants). |

### 3.5 LOW — Cross-References

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **LOGIC_LEAF_PROTOCOL_AUDIT** | Summary | Leaf-only packing | Add: *Rune = leaf = packable. Rune terminology & visualization.* |
| **GAPS_AND_ASSUMPTIONS** | Scenario Coverage | — | Add: *Rune: Packable items = rune stones; distinct visual.* |

---

## 4. Gemini Refinements (Incorporated)

| Refinement | Location |
|------------|----------|
| **Awakening moment** | When Hammer shatters container → leaves, visual shifts Dull Stone → Glowing Rune. MASTER_PLAN § Rune. |
| **Opacity/glow cheat** | Dull = 40% opacity, greyscale. Rune = 100% opacity, glow, pulse. No 50 assets. MASTER_PLAN § Feasibility Refinements. |
| **Landmark visual** | Containers = etched/weathered monoliths; only Runes lift into Satchel. MASTER_PLAN § Rune. |
| **Accountant vs. Spirit** | Japandi materials (Dark Walnut, Roman Clay) on Detail screens. MASTER_PLAN §3, PEAK_JOURNAL_SPEC. |
| **Forest Threshold (fade) speed** | Link to `has_seen_elias_intro`: first-time = slow/cinematic; returning = quick. MASTER_PLAN, ELIAS_INTRODUCTION_SPEC. |
| **4:00 AM Blue Hour** | Hearth as primary light source; dim edges; focus on fire + Satchel. MASTER_PLAN §4. |
| **isPackable(node)** | Strict `child_count == 0` check. MASTER_PLAN § Rune, LOGIC_LEAF_PROTOCOL_AUDIT. |
| **Validity Filter** | Postgres RPC, not client-side. DB returns packable IDs. MASTER_PLAN § Feasibility Refinements. |
| **Depth cap** | 3 levels max. Peak → Boulder → Sub-Boulder → Pebble. MASTER_PLAN § Feasibility Refinements. |
| **Demo mode** | Repository pattern. Supabase vs Mock = toggle. MASTER_PLAN § Feasibility Refinements. |

---

## 5. Implementation Order (When Building Rune)

1. **Opacity/glow trick (MVP)** — Dull Stone: 40% opacity, greyscale. Rune: 100% opacity, subtle outer glow (Shadow), pulse. No 50 custom assets.
2. **Visual assets (Phase 2)** — Optional: Rune stone style for boulder, pebble, shard (leaf variants).
3. **Container visual** — Non-rune style for boulders/pebbles with children (muted, no glow).
4. **UI logic** — Render rune vs non-rune based on has-children.
4. **Elias dialogue** — Add/rotate "rune stone" lines in burn, pack, intro.
5. **Terminology pass** — Audit all user-facing strings; replace "stone" with "rune stone" where packable.

---

## 6. Resolved (No Change Needed)

| Doc | Reason |
|-----|--------|
| **GRACE_DAY_STREAK_SPEC** | Unrelated to rune. |
| **RLS_VERIFICATION** | Unrelated. |
| **WHETSTONE_CHOICE_OVERLAY_SPEC** | Whetstone ≠ rune stones. |

---

**End of Rune Terminology Audit.**
