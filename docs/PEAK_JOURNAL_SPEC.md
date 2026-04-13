# Peak Journal (Mountain Detail Screen) — Technical Ledger Specification

**Purpose:** Transforms a simple task list into a technical ledger of accomplishments. Moves History and Hierarchy here so The Map stays a pristine, high-level overview. Honors both Visionary (whole hillside) and Accountant (every pebble).  
**Status:** Locked — ready for implementation  
**Related:** [MASTER_PLAN.md](MASTER_PLAN.md) Build Out 10, [NAVIGATION_MAP.md](NAVIGATION_MAP.md)

---

## 1. Route & Navigation

| Item | Spec |
|------|------|
| **Route** | `/scroll/:mountainId` |
| **Structure** | **Sibling** to `/scroll`. Logically "under" the Map, but sibling route for cleaner go_router. |
| **Back behavior** | "Back" on mobile = deliberate retreat from peak → global Sanctuary view. |

---

## 2. Map Refactor — The "High-Level" Shift

Clean the bones of `ScrollMapScreen`.

| Change | Spec |
|--------|------|
| **Remove** | Full tree of pebbles and shards from Map view. |
| **New Map Card** | Each peak = "Refined Architectural" summary card. Peak Name, Identity Icon, Minimalist Progress Bar. |
| **Trigger** | Single tap on card (or mountain icon) → push to Detail Screen. |

---

## 3. Detail Layout — The Technical Ledger

Refined Luxury, Japandi simplicity. Lots of negative space, high-quality typography. **Accountant vs. Spirit balance:** Use Japandi materials (Dark Walnut, Roman Clay textures) to skin the Detail screen—logic is rigid, but the texture remains cozy. Avoids feeling like two different products stapled together.

| Component | Design / Function |
|-----------|-------------------|
| **Header** | Intent (from Step 0) displayed as quote. "This matters because..." Tap → Roman Clay-style edit overlay. Name (Identity) also editable via same overlay—no wizard restart. |
| **Progress** | Thin, elegant progress line. Below: "Burned Pebbles" vs "Total Weight." *Logic & Leaf: Count leaves (packable nodes); containers complete when all children done.* |
| **Tree** | Vertical, collapsible hierarchy. Stones (Boulders) = headers; Pebbles listed below. Only place you see every detail. |
| **Bones/Chronicled** | "Sacred Actions" menu at bottom. "Abandon the Climb" (node delete) or "Chronicle this Peak" (archive/complete). |

---

## 4. The Transition — "The Zoom"

Storybook feel. Hero transition.

| Phase | Spec |
|-------|------|
| **Motion** | Tap peak on Map → Mountain Icon expands and centers, becomes header background of Detail Screen. |
| **Zoom** | Camera feels like it's flying forward into that coordinate on the scroll. |
| **Lore** | Elias appears from the side on arrival: *"Welcome to the base of this peak. Let us look at the path you've carved."* |

---

## 5. Implementation Checklist for Cursor

- [ ] `go_router`: Add `/scroll/:mountainId` as sibling route
- [ ] `CustomTransitionPage` for the Zoom effect
- [ ] `Hero` widgets: Mountain Icon + Name wrap; unique tag per `mountainId`
- [ ] `ScrollMapScreen` refactor: remove full tree; summary cards (Name, Icon, Progress Bar)
- [ ] Tap card → push to Detail
- [ ] `SliverList` for boulder/pebble tree (smooth scroll for 50+ items)
- [ ] Intent: quote display; tap → Roman Clay edit overlay
- [ ] Progress: thin line + "Burned Pebbles / Total Weight"
- [ ] Collapsible hierarchy: Boulders = headers, Pebbles below
- [ ] Sacred Actions: "Abandon the Climb" (node delete), "Chronicle this Peak" (Chronicled Peaks)
- [ ] Elias arrival line: `peakJournalArrival()` — *"Welcome to the base of this peak. Let us look at the path you've carved."*

---

**End of Peak Journal Spec.**
