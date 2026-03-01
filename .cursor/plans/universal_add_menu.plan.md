# Universal Add Menu – Implementation Plan

## Summary

All main pages (Vault, Garden, Journal, Calendar) now use a unified **Universal Add Menu** when the FAB is tapped (when not in selection mode).

## Screen 1: What to add

| Option | Screen 2 / Behavior |
|--------|---------------------|
| **Add seed** | QuickAddSeed (Manual / Photo / Link / Purchase Order) |
| **Add plant** | Manual Entry \| From Vault |
| **Add to shed** | QuickAddSupply (Manual / Photo / Link / Purchase Order) |
| **Add task** | Task form (inline on Calendar) or `/calendar?openTask=1` |
| **Add journal** | Snapshot \| Quick note \| Detailed → all navigate to `/journal/new` |

## Add plant – Screen 2

- **Manual Entry** → AddPlantModal (default type: seasonal on Active Garden, permanent on My Plants)
- **From Vault** → `/vault/plant?from=garden|calendar|vault|journal`

## Key behaviors

- **Selection mode**: When items are selected (Vault batch, Garden batch, Journal entries), FAB opens selection menu, not add menu.
- **Post-add**: Stay on current page, refresh data.
- **Removed**: Garden "Add journal entry" bulk mode (replaced by Add journal → Detailed → `/journal/new`).

## Files changed

- `src/components/UniversalAddMenu.tsx` (new)
- `src/app/vault/VaultPageContent.tsx`
- `src/app/garden/page.tsx`
- `src/app/journal/page.tsx`
- `src/app/calendar/page.tsx`
- `docs/NAVIGATION_MAP.md`

## Context passed

- `pathname` – for From Vault navigation
- `gardenTab` – "active" | "plants" for Add plant default type (Garden only)
