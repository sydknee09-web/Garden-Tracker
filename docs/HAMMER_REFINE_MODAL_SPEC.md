# Hammer (Refine Modal) — Shatter Specification

**Purpose:** The most satisfying interaction in the ritual—transforms a "problem" (stone too heavy) into "solutions" (pebbles you can carry). Vision stays solid; labor stays flexible. The modal is the surgical station for goals.  
**Status:** Locked — ready for implementation  
**Related:** [MASTER_PLAN.md](MASTER_PLAN.md) Build Out 9, [PRE_FLIGHT_ARCHITECTURE_SPEC.md](PRE_FLIGHT_ARCHITECTURE_SPEC.md), [ELIAS_DIALOGUE_REFERENCE.md](ELIAS_DIALOGUE_REFERENCE.md)

---

## 0. One Modal, Two Contexts (Logic & Leaf)

**Same Refine Modal; context determines behavior.** See [PRE_FLIGHT_ARCHITECTURE_SPEC.md](PRE_FLIGHT_ARCHITECTURE_SPEC.md) §4.

| Context | Action | UI Label |
|---------|--------|----------|
| **Boulder** (container) | Shatter into Pebbles | "Shatter into Pebbles" |
| **Pebble** (container/leaf) | Refine into Shards | "Refine into Shards" |

**UI cue:** Hammer glows/appears on a Pebble in the Satchel **only if** that pebble can be refined (leaf pebble = no shards yet; user can break it into sub-tasks). With leaf-only packing, only leaves are in the Satchel—so a Pebble there is a Rune Pebble (no shards). Hammer on it = "Refine into Shards." After refine, pebble becomes container; its shards (new leaves) become packable.

### Context-Distinct Animation & Haptics

| Context | Animation | Haptic |
|---------|-----------|--------|
| **Boulder** (Shatter) | Heavy rocks breaking—large fragments, dramatic scale. "Shattering" feel. | Stronger vibration (heavy strike). |
| **Pebble** (Refine) | Smaller, precise sparks—finer particles, subtle crack. "Refining" feel. | Lighter vibration (precise tap). |

**Rationale:** The visual and haptic difference justifies the Logic & Leaf complexity to the user. Boulder = coarse break. Pebble = surgical refinement. Don't over-log; use subtle haptics when the Hammer context shifts.

---

## 1. Trailing Icon — The "Striking Point"

Refined Architectural look. Hammer is not a loud button.

| Item | Spec |
|------|------|
| **Placement** | Far right of each Stone row in the Your Satchel list. |
| **Visual** | Minimalist, hand-drawn style hammer icon. Muted copper or "Aged Bronze" tone. |
| **Interaction** | On hover or long-press: tiny 2-degree "vibration" tilt—signals readiness to strike. |

---

## 2. Refine Modal — The "Shatter" Layout

Distinct from Edit overlay. Visual weight reflects the lore of breaking boulders.

| Element | Spec |
|---------|------|
| **Header** | Elias at top, focused pose. |
| **Elias prompt** | *"A heavy stone is just a collection of pebbles waiting for a strike."* |
| **Boulder (Stone)** | Stone name (e.g., "Guest Bath Remodel") in bold serif font, inside rock-textured container. *Logic & Leaf: Stone may be pebble (container); Hammer may shatter into shards.* |
| **Pebbles (Inputs)** | Dynamic list below boulder. Each row = text input for pebble name. |
| **Add** | (+) icon creates new blank row. |
| **Delete** | Trailing (x) for pebbles entered in error. |
| **Visual ritual** | When pebble added: subtle "stone crack" sound + small particle animation near boulder container. **High-impact:** When packing is restricted to leaves, the Hammer shatter must feel rewarding—it's the payoff for breaking a container into packable runes. |

---

## 3. The Break Action — Technical Logic

| Phase | Action |
|-------|--------|
| **Strike (Save)** | User taps final "Strike" button. |
| **API** | Iterate inputs; call `nodeActionsProvider.createPebble` for each entry. |
| **Parent-child** | Pebbles auto-linked to StoneID of the boulder being refined. |
| **Batch** | Call in batch or sequential `await` loop to prevent database race conditions. |
| **Success ritual** | Boulder container "shatters" (fades out + scale-up). New pebbles populate Satchel list immediately. |

---

## 4. Elias Dialogue (Edit Flow Pool)

| Action | Pool Key | Line |
|--------|----------|------|
| Open modal | `openEdit` | *"Let us look closer at this weight. Where shall we strike?"* |
| Add pebble | `afterAddPebble` | *"A fine fragment. That is one less burden for the spirit."* |
| Rename stone | `afterRename` | *"A new name, a new path. It feels lighter already."* |
| Delete pebble | `afterDelete` | *"Let the dust return to the earth. We only carry what is useful."* |

---

## 5. Implementation Checklist for Cursor

- [ ] `SatchelItemTile`: trailing hammer icon (far right), Aged Bronze, hand-drawn style
- [ ] Hover/long-press: 2-degree vibration tilt
- [ ] Tap hammer → `showLoreModal` with `RefineOverlay` content
- [ ] `List<TextEditingController>` for pebble inputs; focus on newest when Add tapped
- [ ] `CustomPainter` for "cracked stone" effect overlaying Stone name as pebbles added
- [ ] Stone crack sound + particle animation on Add pebble
- [ ] "Strike" button → batch/sequential `nodeActionsProvider.createPebble` per pebble
- [ ] Parent-child link: pebbles → boulder `StoneID`
- [ ] Success: boulder container shatter (fade + scale-up); pebbles populate Satchel
- [ ] Elias: `openEdit`, `afterAddPebble`, `afterRename`, `afterDelete` per table above

---

**End of Hammer Refine Modal Spec.**
