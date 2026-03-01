---
name: ""
overview: ""
todos: []
isProject: false
---

# Plant Placeholder and Loading Screen Implementation

## Summary

Use `public/plant-placeholder.png` for:

1. **Sprout replacement** — Replace all `🌱` emoji usages with the new image
2. **Loading screen** — Show during initial app open (auth loading), then fade out
3. **Skip button** — Let users skip the loading animation and go straight into the app

---

## Part 1: Sprout Emoji Replacement

### 1.1 Create shared component

Create `src/components/PlantPlaceholderIcon.tsx`:

- Renders `<img src="/plant-placeholder.png" alt="" aria-hidden />`
- Accepts `size` prop: `"sm"` | `"md"` | `"lg"` | `"xl"` (maps to ~20px, 24px, 40px, 48px)
- Accepts optional `className` for layout (e.g. `flex items-center justify-center`)

### 1.2 Replace emoji usages

Update all files that use `🌱` to use `<PlantPlaceholderIcon />` instead:


| File                                        | Context                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/app/vault/[id]/page.tsx`               | Hero placeholder (2 places: "Finding photo", empty state)                                  |
| `src/components/ActiveGardenView.tsx`       | Batch cards grid + list                                                                    |
| `src/components/MyPlantsView.tsx`           | Plant cards list + grid                                                                    |
| `src/components/SeedVaultView.tsx`          | Packet/plant cards (4 places)                                                              |
| `src/components/PacketVaultView.tsx`        | List row fallback                                                                          |
| `src/app/garden/page.tsx`                   | Empty state, search results                                                                |
| `src/app/page.tsx`                          | Home dashboard                                                                             |
| `src/app/vault/import/photos/hero/page.tsx` | Hero picker placeholder                                                                    |
| `src/components/EmptyState.tsx`             | Default icon prop — change to accept `ReactNode` and use `PlantPlaceholderIcon` as default |


**Celebration animations** (plant/calendar pages): Keep `🌱` with `seedling-celebration-sprout` class for the micro-animation.

---

## Part 2: Loading Screen (App Open Only)

### 2.1 Create LoadingScreen component

Create `src/components/LoadingScreen.tsx`:

- Full-screen centered layout (`min-h-screen`, flex center)
- Displays `**app-icon.png`** (gnome mascot) at a comfortable size (e.g. 120–160px)
- **Fade-in/fade-out animation** — Image fades in and out in a loop to symbolize loading (e.g. opacity 0.4 → 1 → 0.4, ~2s cycle). Respects `prefers-reduced-motion` (disable or simplify).
- Background: `bg-paper` to match app
- **Skip button** — "Skip" button below the icon; when clicked, proceeds immediately to app (bypasses any minimum display time)

### 2.2 Integrate into AuthGuard

In `src/components/AuthGuard.tsx`:

- When `loading` is true: show `<LoadingScreen onSkip={...} />` instead of current "Loading…" or skeleton+header+nav
- **Skip behavior:** When user clicks Skip, set `skipped=true`. Proceed to main app as soon as auth resolves (no minimum display time). If auth is already resolved, show app immediately.
- Optional: Without Skip, add a minimum display time (e.g. 1.5s) so the animation feels intentional; Skip bypasses this.

### 2.3 Skip button implementation

- Button: "Skip" — minimal styling, below the seedling image
- `onSkip` callback: AuthGuard sets state to bypass loading and show app
- Logic: Auth loading cannot be skipped (we need session). Skip means "show app as soon as auth is ready" — no artificial delay. If we add a minimum display time for the animation, Skip bypasses it.

---

## Part 3: seedling-icon.svg and DB placeholder

Keep `seedling-icon.svg` as the DB placeholder string. The UI never displays it; we show `PlantPlaceholderIcon` when there's no real hero. No migration needed.

---

## Files to Create

- `src/components/PlantPlaceholderIcon.tsx`
- `src/components/LoadingScreen.tsx`

## Files to Modify

- `src/components/AuthGuard.tsx` — use LoadingScreen when loading; handle Skip
- `src/components/EmptyState.tsx` — icon prop accepts ReactNode, default PlantPlaceholderIcon
- ~10 files with `🌱` — replace with PlantPlaceholderIcon

---

## Removed from plan

- ~~Developer toggle: Skip loading animation~~ — Replaced by Skip button on the loading screen itself. No settings page change needed.
- ~~Recommend-care-tasks API (one_off + interval_days)~~ — Unrelated to plant placeholder/loading screen. Can be a separate task if needed.

