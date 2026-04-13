# Satchel Pack Animation — Weight & Motion Specification

**Purpose:** Rune stones feel gathered from the peaks you just committed to. Immersive "lift and drop" into the Satchel. Japandi calm—no visual noise. *Rune = packable leaf; distinct rune visualization.*  
**Status:** Locked — ready for implementation  
**Related:** [MASTER_PLAN.md](MASTER_PLAN.md) Build Out 6

---

## 1. Origin & Path

| Aspect | Spec |
|--------|------|
| **Origin** | Rune stones (packable leaves) animate from their respective **Marker positions on the Map**. |
| **Path** | Slight arc—"lift and drop" motion—landing into the Satchel icon (bag) or designated slots in the Satchel list. |
| **Visual trail** | Subtle vellum-colored dust or light when a stone flies. Palette: `#C26D2B` (orange). |
| **Landing feedback** | Satchel bag gives a slight "thud" scale animation (1.0 → 1.1 → 1.0) to communicate weight. |

---

## 2. Trigger & Timing Hierarchy

| Phase | Action | Timing |
|-------|--------|--------|
| **1. Commitment** | User hits "Pack this Journey." | T = 0ms |
| **2. The Flight** | Stones arc from the Map into the Satchel icon. | T + 100ms |
| **3. Completion** | Satchel "thud" animation and haptic feedback. | T + 600ms |
| **4. Confirmation** | SnackBar appears: *"Your Satchel is prepared."* | T + 800ms |

**SnackBar Rule:** The SnackBar must always come **after** the animation. If text appears while stones are still flying, it creates visual noise that breaks the Japandi calm.

---

## 3. Duration & Staggering

| Item | Value |
|------|-------|
| **Per-stone duration** | 500ms. Fast enough to feel snappy, slow enough to track the path of intention. |
| **Stagger** | 150ms between stone start times. |
| **Example** | Stone 1 at 0ms, Stone 2 at 150ms, Stone 3 at 300ms. |

Creates a "pop-pop-pop" rhythm—organic and artisanal, not robotic block motion.

---

## 4. Implementation Logic for Cursor

**Overlay Entry:** Use a `GlobalKey` to find the render box position of the selected Markers on the Map and the Satchel icon in the footer.

**Tween Path:** Implement a `CurvedAnimation` using `Curves.easeOutBack` to create the arc effect.

**Haptic Integration:** Trigger `HapticFeedback.mediumImpact()` exactly when the stone "lands" in the satchel slot.

**State Cleanliness:** Markers on the Map transition to an "Active/Packed" state (subtle glow or color shift) **only after** the animation finishes—reinforcing that they are now "carried."

---

## 5. The Lore of the Pack

Elias dialogue trigger for this moment:

> *"Careful, traveler. The more you pack, the slower the climb. Choose only the rune stones you are ready to face today."*

---

## 6. Cursor Implementation Checklist

- [ ] `GlobalKey` for Map Marker positions and Satchel icon
- [ ] Overlay with flying stone widgets; origin = Marker render box, destination = Satchel
- [ ] `CurvedAnimation` + `Curves.easeOutBack` for arc path
- [ ] Per-stone duration 500ms; stagger 150ms
- [ ] Vellum trail (`#C26D2B`) during flight
- [ ] Satchel "thud" scale (1.0 → 1.1 → 1.0) at T + 600ms
- [ ] `HapticFeedback.mediumImpact()` on landing
- [ ] SnackBar at T + 800ms: "Your Satchel is prepared."
- [ ] Marker → Active/Packed state only after animation completes
- [ ] Elias line: "Careful, traveler. The more you pack..."

---

**End of Satchel Pack Animation Spec.**
