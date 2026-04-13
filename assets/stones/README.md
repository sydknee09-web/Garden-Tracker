# Stone / Rock Assets

Two **parallel** families by size tier (boulder / pebble / shard). **Do not** treat `stone_*.png` as “the same rock with a filter”—they are **different art** from `*Rock.png`.

| Tier | Natural rock (packed, not ready for hearth) | Rune stone (marked done → `ready_to_burn`, draggable to hearth) |
|------|-----------------------------------------------|------------------------------------------------------------------|
| Large / boulder | `LargeRock.png` | `stone_large.png` |
| Medium / pebble | `MediumRock.png` | `stone_medium.png` |
| Small / shard | `SmallRock.png` | `stone_small.png` |

**Code:** `satchelStoneImagePath(Node? node, {required bool readyToBurn})` in `lib/core/utils/satchel_stone_assets.dart`.

**Home tray:** Slots with no packed node stay **visually empty** (fixed width); see `docs/CORE_LOOP_SOURCE_OF_TRUTH.md` §4.4.

**Style:** Hand-drawn; transparent backgrounds. Suitable for the “Refined Architectural Luxury” aesthetic.

**Wiring:** Sanctuary dock + Satchel rows use the helper above. Other screens (e.g. hammer refine modal) may still reference `stone_*.png` directly for ritual UI—audit when touching those flows.
