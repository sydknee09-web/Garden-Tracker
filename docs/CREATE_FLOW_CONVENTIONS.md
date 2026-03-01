# Create Flow Conventions

Conventions for all Create/Add flows (seed, plant, supply, journal, task, review-import). Use these when adding or modifying create forms.

---

## Required vs Optional Labeling

- **Required fields:** Add `*` after the label (e.g. `Plant Name *`)
- **Optional fields:** Add `(optional)` suffix (e.g. `Notes (optional)`)

---

## Canonical Field Order (Plant/Seed/Supply)

When collecting plant, seed, or supply data, use this order:

1. Name / Plant type
2. Variety
3. Vendor
4. Volume (seeds) or Quantity (plants)
5. Purchase date / Planting date / Due date
6. Location (when applicable)
7. Photos
8. Notes
9. Source URL (when applicable)

---

## Date Field Labels

- **Seed/Supply:** "Purchase date"
- **Plant (Add Plant modal):** "Date planted" (permanent) or "Purchase date" (seasonal)
- **Plant (Start Seeds):** "Planting date"
- **Task:** "Due date"

---

## Modal Back/Cancel Pattern

- **Back:** Top-left arrow or "Back" button to return to previous screen (choose method, etc.)
- **Cancel:** Bottom button to close modal entirely
- **Submit:** Primary action (Add, Save) full-width or right-aligned

---

## When to Show

- **Source URL:** Seed packets, supply profiles. Law 8: always save vendor link when importing from URL.
- **Photos:** Optional on most create flows. First photo becomes profile hero where applicable.
- **Notes:** Optional on all flows. Use for user-specific context.
