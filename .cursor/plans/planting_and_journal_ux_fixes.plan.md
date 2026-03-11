# Planting and Journal UX Fixes (Revised)

## Summary

Address six issues: journal entry context, icon consistency, planting page layout, add-new-packet flow, seed packet ordering, and hero image flash. **Back arrow:** Planting page only — fix physical position to match other pages (link unchanged).

---

## 1. Journal Entry Display (Planting Entries Look Incomplete)

**Fix in two places:**

**A. vault/plant page** ([vault/plant/page.tsx](src/app/vault/plant/page.tsx) lines 367-374):
- Prefix: "Sowed {displayName}"
- Append location if set, sow method, user notes
- Example: `Sowed Tomato (San Marzano) in Raised bed #2 via seed start. Started indoors`

**B. VaultPageContent plant modal** ([VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx) lines 903-904, 948-949):
- Replace `noteText` with same format: "Sowed {displayName}" + sow method + notes
- VaultPageContent has no location field; use displayName, plantSowMethod, plantNotes
- Example: `Sowed Tomato (San Marzano) via seed start. Started indoors`

---

## 2. Icon Cohesiveness

**Selection menu** ([garden/page.tsx](src/app/garden/page.tsx) lines 1326-1385): Replace emoji (🌳, 📦) with inline SVG icons matching trash/pencil stroke style.

**Back arrow — planting page only:** Move the back link out of the centered block so it appears top-left (like vault/history, settings). The link and text stay the same; only the layout changes.

Current (centered):
```tsx
<div className="text-center mb-4">
  <Link ...>← Back to Vault</Link>
  <h1>Planting</h1>
  ...
</div>
```

Revised (left-aligned, matches other pages):
```tsx
<Link ... className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">← Back to Vault</Link>
<div className="text-center mb-4">
  <h1>Planting</h1>
  ...
</div>
```

---

## 3. Planting Page Layout

**Fix:** Reorder so seed packet section (rows + Add Seed) is above supplies. Order: Date/Location/Sow/Notes → Seed rows + Add Seed → Supplies → Confirm.

---

## 4. Add New Packet Bug

**Fix in** [vault/plant/page.tsx](src/app/vault/plant/page.tsx):
1. Placeholder: `e.g. Tomato (Brandywine) or Tomato` + hint "Use Plant (Variety) for full details."
2. Call `enrichProfileFromName` with `skipHero: true` during planting.
3. Add timeout (e.g. 15s) around enrichment; on timeout, continue with basic profile.

---

## 5. Seed Packet Order (Alphabetical)

**Fix:** Sort `availableProfilesForPicker` by display name before `setAvailableProfilesForPicker` in [vault/plant/page.tsx](src/app/vault/plant/page.tsx) (lines 202-204).

---

## 6. Plant Profile Hero Image Flash

**Fix in** [vault/[id]/page.tsx](src/app/vault/[id]/page.tsx): Add `heroImageLoaded` state and `onLoad` on hero `<img>`. Only show camera "Change photo" overlay when image has loaded. Show skeleton/placeholder until loaded to avoid flash.

---

## Implementation Order

1. Journal note
2. Seed packet alphabetical order
3. Add new packet (placeholder, skipHero, timeout)
4. Planting page layout (reorder)
5. Back arrow position (planting page only)
6. Icon cohesiveness (selection menu)
7. Hero image flash

---

## Files to Modify

| File | Changes |
|------|---------|
| [src/app/vault/plant/page.tsx](src/app/vault/plant/page.tsx) | Journal note, Add Seed placeholder/hint, skipHero + timeout, reorder layout, sort picker, back link position |
| [src/app/vault/VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx) | Journal note (Sowed + displayName + sow method + notes) |
| [src/app/garden/page.tsx](src/app/garden/page.tsx) | Replace emoji with SVG in selection menu |
| [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx) | Hero: onLoad, heroImageLoaded, defer camera overlay |

---

## Out of Scope (per user)

- App-wide back arrow standardization
- Selection menu back arrow changes
- Changing back link destinations

---

## Appendix: Other Planting Journal Flows (Standardize Now?)

| Flow | File | Current Note | Data Available | Journal Quality |
|------|------|--------------|----------------|-----------------|
| **vault/plant** (dedicated page) | `vault/plant/page.tsx` | `plantNotes` only (often empty) | displayName, location, sowMethod, plantNotes | **Poor** – empty or vague |
| **VaultPageContent** (plant modal from Vault) | `VaultPageContent.tsx` | `"Planted"` or `"Planted. {notes}"` | displayName, sowMethod, plantNotes; **no location** | **Poor** – no plant name in note |
| **completeSowTask** (mark Sow task done) | `completeSowTask.ts` | `"Sowed {displayName}"` | displayName only; no location/sow method (task flow) | **Good** – explains what happened |
| **AddPlantModal** (add plant from Journal/Home) | `AddPlantModal.tsx` | `"Planted {displayName}"` or `"Planted {displayName}. {notes}"` | displayName, notes | **Good** – includes plant name |

### Recommendation

- **vault/plant** – In plan; will use rich note (displayName + location + sow method + notes).
- **VaultPageContent** – **Now in plan.** Same format: `Sowed {displayName}` + sow method + notes. Location not collected in this modal.
- **completeSowTask** – Already uses `Sowed {displayName}`. No change needed.
- **AddPlantModal** – Store-bought/permanent plants, not seed. Uses "Planted" intentionally. **No change needed.**
