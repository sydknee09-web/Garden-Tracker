# Loading Screen UX Fixes (Updated)

**Status:** Part 1 and Part 3 Done (initial load only, Skip removed; PageSkeleton on in-app nav). Part 2 (teal/fade-in) and Part 4 (cacheControl) optional or verify.

## Summary

1. **Suppress loading screen during navigation** — Show branded LoadingScreen only on initial app open; use PageSkeleton during in-app navigation if loading.
2. **Restore opening load screen** — Blended background (emerald-50), fade-in only (no fade-out).
3. **Remove Skip button** — No Skip on initial loading screen.
4. **SW caching + cacheControl** — Ensure Supabase Storage images are cached by SW and all uploads set cacheControl for repeat-load behavior and reduced egress.

---

## Part 1: LoadingScreen Only on Initial App Open

**File:** [src/components/AuthGuard.tsx](src/components/AuthGuard.tsx)

- Add `hasCompletedInitialLoadRef = useRef(false)`.
- When `showLoadingScreen` is true:
  - If `hasCompletedInitialLoadRef.current`: show PageSkeleton for current route (no LoadingScreen).
  - Else: show LoadingScreen.
- When loading finishes and we show app: set `hasCompletedInitialLoadRef.current = true`.
- Remove `skipped` state and `onSkip` — no Skip button.

---

## Part 2: LoadingScreen Appearance

**File:** [src/components/LoadingScreen.tsx](src/components/LoadingScreen.tsx)

- Remove `onSkip` prop and Skip button entirely.
- Background: Light teal `#85d2d2` (or `#9ddbdb`) to match app icon — add custom color in tailwind or use `bg-[#85d2d2]`.
- Add fade-in animation on mount (e.g. `animate-in fade-in duration-300` or custom keyframes).
- No fade-out on exit.

**File:** [src/app/globals.css](src/app/globals.css)

- Add loading-screen fade-in keyframes if needed.

---

## Part 3: Remove Skip from AuthGuard

**File:** [src/components/AuthGuard.tsx](src/components/AuthGuard.tsx)

- Remove `skipped` state.
- Remove `setSkipped` and `onSkip` callback.
- Simplify `showLoadingScreen` to `loading || minDisplayPending` (no `!skipped` check).
- Pass no `onSkip` to LoadingScreen (or remove prop from LoadingScreen).

---

## Part 4: SW Caching for Supabase Storage + cacheControl on Uploads

### 4a. Service Worker

**File:** [public/sw.js](public/sw.js)

The SW already has Supabase Storage caching (lines 37–57): stale-while-revalidate for `supabase.co` / `supabase.io` URLs with `/storage/v1/object/public/`. Verify it works; optionally bump `CACHE_NAME` to `seed-vault-v4` to force refresh.

### 4b. Add cacheControl to Uploads Missing It

Add `cacheControl: "31536000"` (1 year) to these uploads:

| File | Line | Change |
|------|------|--------|
| [src/components/BatchAddSeed.tsx](src/components/BatchAddSeed.tsx) | 573 | Add `cacheControl: "31536000"` to upload options |
| [src/app/api/seed/batch-import/route.ts](src/app/api/seed/batch-import/route.ts) | 166 | Add `cacheControl: "31536000"` |
| [src/app/api/supply/extract-from-url/route.ts](src/app/api/supply/extract-from-url/route.ts) | 128 | Add `cacheControl: "31536000"` |
| [src/app/vault/review-import/page.tsx](src/app/vault/review-import/page.tsx) | 719, 868, 915, 949 | Add `cacheControl: "31536000"` to all 4 uploads |

---

## Files to Modify

| File | Changes |
|------|---------|
| [src/components/AuthGuard.tsx](src/components/AuthGuard.tsx) | Add hasCompletedInitialLoadRef; remove skipped/onSkip; gate LoadingScreen to initial load |
| [src/components/LoadingScreen.tsx](src/components/LoadingScreen.tsx) | Remove onSkip and Skip button; emerald background; fade-in |
| [src/app/globals.css](src/app/globals.css) | Fade-in keyframes if needed |
| [public/sw.js](public/sw.js) | Bump CACHE_NAME to v4 (optional) |
| [src/components/BatchAddSeed.tsx](src/components/BatchAddSeed.tsx) | Add cacheControl to upload |
| [src/app/api/seed/batch-import/route.ts](src/app/api/seed/batch-import/route.ts) | Add cacheControl to upload |
| [src/app/api/supply/extract-from-url/route.ts](src/app/api/supply/extract-from-url/route.ts) | Add cacheControl to upload |
| [src/app/vault/review-import/page.tsx](src/app/vault/review-import/page.tsx) | Add cacheControl to 4 uploads |
