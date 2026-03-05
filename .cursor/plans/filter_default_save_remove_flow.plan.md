# Filter Default Save/Remove Flow

## Overview

Establish a clear Save Default / Remove Default flow for filter views on Vault and Garden. When a default exists, only "Remove Default" is shown; user must remove before saving a new default. **Include both filters and sort** in the saved default. Ensure the default buttons are visible in the filter modal.

## Current State

Filter default infrastructure already exists:

- **[filterDefaults.ts](src/lib/filterDefaults.ts)** – localStorage persistence with keys: `garden-active`, `garden-plants`, `vault-profiles`, `vault-packets`, `vault-shed`
- **[useFilterState.ts](src/hooks/useFilterState.ts)** – `saveAsDefault`, `clearDefault`, `hasDefault` for Garden and Vault profiles
- **Vault** ([VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx)): Grid (plant profiles), List (packets), and Shed each have Save/Clear default
- **Garden** ([garden/page.tsx](src/app/garden/page.tsx)): Active Garden and My Plants have Save/Clear default
- **Vault packets** already include sort in `PacketFilterDefault`; **Vault grid** and **Garden** currently use sessionStorage for sort (not in filter default)

---

## Requirements Summary

| Requirement | Implementation |
|-------------|----------------|
| "Save Default" when no default | Rename "Save as default" to "Save Default" |
| "Remove Default" when default exists | Rename "Clear default" to "Remove Default"; show only this button when `hasDefault` |
| Must remove before saving new default | When `hasDefault`, hide "Save Default" entirely |
| Include filters + sort in default | Extend Garden and Vault grid defaults to include sortBy/sortDir |
| Independent per tab | 5 keys (garden-active, garden-plants, vault-profiles, vault-packets, vault-shed) |
| Defaults apply on load/refresh | Load and apply both filters and sort on mount |

---

## Implementation Plan

### 1. Fix Filter Modal Layout (Visibility)

**Garden** ([garden/page.tsx](src/app/garden/page.tsx) ~line 638):
- Add `min-h-0` to the scrollable content wrapper
- Increase `max-h-[70vh]` to `max-h-[85vh]` to match Vault

**Vault** ([VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx) ~line 1457):
- Add `min-h-0` to the scroll container so the footer stays pinned

### 2. Label and Logic Changes

All locations: "Save as default" → "Save Default", "Clear default" → "Remove Default". When `hasDefault`, show only "Remove Default" (hide "Save Default").

- **Garden** (footer ~lines 878–904)
- **Vault grid** (footer ~lines 1892–1940)
- **Vault list** (footer ~lines 1912–1955)
- **Vault shed** (footer ~lines 1388–1414)

### 3. Include Sort in Defaults

**Garden** ([garden/page.tsx](src/app/garden/page.tsx)):
- Extend saved payload for `garden-active` and `garden-plants` to include `{ sortBy, sortDir }`
- On Save Default: save `{ ...filters, sortBy, sortDir }` via extended `saveFilterDefault` or custom save
- On mount: if filter default exists, load and apply both filters (via useFilterState) and sort (set activeSortBy/plantsSortBy etc.)
- useFilterState may need to support extended payload, or page handles combined save/load

**Vault grid** ([VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx)):
- Extend `vaultProfiles` default to include `sortBy` and `sortDirection` (VaultSortBy: "name" | "purchase_date" | etc.)
- Currently sort is in sessionStorage "vault-sort"; migrate to filter default
- On Save Default: save `{ ...vaultFilters.filters, sortBy, sortDirection }`
- On load: apply filters and sort from saved default

**Vault list (packets)**: Already includes sort in `PacketFilterDefault`. No change.

**Vault shed**: No sort. No change.

### 4. Data Structure Changes

**Garden default payload** (garden-active, garden-plants):
```ts
{ ...GardenFilterValues, sortBy: string, sortDir: "asc" | "desc" }
```

**Vault profiles default payload** (vault-profiles):
```ts
{ ...VaultFilterValues, sortBy: VaultSortBy, sortDirection: "asc" | "desc" }
```

**useFilterState** ([useFilterState.ts](src/hooks/useFilterState.ts)):
- Extend to support saving/loading extended payload when schema is garden or vault
- Add `saveAsDefault(extended?: { sortBy?: string; sortDir?: string })` for garden
- Add `loadedSort?: { sortBy: string; sortDir: string } | null` to return for initial apply
- Or: handle at page level with custom save/load that combines filters + sort

### 5. Files to Modify

| File | Changes |
|------|---------|
| [src/app/garden/page.tsx](src/app/garden/page.tsx) | Modal layout, footer labels, include sort in save/load for both tabs |
| [src/app/vault/VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx) | Scroll layout, footer labels, include sort in vault-profiles default |
| [src/hooks/useFilterState.ts](src/hooks/useFilterState.ts) | Optional: extend payload for sort; or handle in pages |
| [src/lib/filterDefaults.ts](src/lib/filterDefaults.ts) | No change (generic load/save) |

---

## Behavior Summary

- **No default**: User sets filters + sort → taps "Save Default" → default saved. On next load, filters and sort are applied.
- **Has default**: Only "Remove Default" visible. User taps it → default cleared. "Save Default" appears again.
- **Save Default** disabled/hidden when default exists; user must remove first.
