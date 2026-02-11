# QC Audit Log — Seed Vault Project

**Role:** Senior Lead Engineer & Security Auditor  
**Scope:** Performance, error resilience, type safety, Supabase RLS, UI/UX consistency  
**Date:** 2025-02-05

---

## 1. Performance Audit (scrape-url/route.ts)

- **Timeout value:** Code uses `SCRAPE_TIMEOUT_MS = 15_000` (15s). If the product requirement is 10s, this is a **spec mismatch** (see Optimizations).
- **Timeout implementation:** Implemented correctly in two places:
  - `AbortController` + `setTimeout(..., SCRAPE_TIMEOUT_MS)` aborts the `fetch()` so the request does not hang.
  - `Promise.race([scrapePromise, timeoutPromise])` with a 15s reject ensures the handler returns within 15s. Catch block handles `SCRAPER_TIMEOUT` and `AbortError` and returns a proper JSON response (Failed + fallback metadata or error payload).
- **Memory / large HTML:** The route uses `const html = await res.text()`, loading the full response body into memory. For very large vendor pages (e.g. multi‑MB HTML), this can cause high memory usage and pressure on the Node/Edge runtime. Parsing is done in process (no streaming). No explicit retention of `html` after the response is built, so it can be GC’d after the request; the main risk is peak memory on large pages.
- **Timer leak:** When the scrape succeeds before the timeout, `timeoutPromise`’s `setTimeout` is never cleared, so a timer remains until it fires (~15s later). Minor; worth clearing on success (see Optimizations).

---

## 2. Error Resilience (“Lazy Load” / Load Seed Details)

- **Broken or 404 source_url:** When “Load Seed Details” is used and the URL returns 4xx/5xx, the scrape API returns HTTP 200 with `error: "Page returned 404."` (or similar) and `scrape_status: "Failed"`. The vault detail page:
  - Sets `loadSeedDetailsError` with a user‑friendly message (including special copy for 403/forbidden).
  - Persists `scrape_status` and `scrape_error_log` via `auditUpdates` so the failure is recorded.
  - Does **not** show a white screen; the error is shown in context (specs area) and the rest of the page remains usable.
- **Vault detail load failure (missing plant / DB error):** When the initial load of the plant by `id` fails (`e || !p`), the page sets `error` and `plant = null`, then renders a dedicated error state: “← Back to Vault” link and a card with `error ?? "Plant not found."` (styled with `text-citrus`). No white screen.
- **Loading state:** While `loading` is true, the page shows “Loading…” in a centered container. No blank screen.

**Conclusion:** Error states are handled; broken or 404 source URLs and failed plant load both show explicit messages and navigation, not a white screen.

---

## 3. Type Safety (plantDefaults.ts)

- **Strict typing:** `PLANT_CATEGORY_DEFAULTS` is defined with `as const`, and `PlantCategoryKey = keyof typeof PLANT_CATEGORY_DEFAULTS`. No `any`; types are strictly enforced. The scraper uses `PlantCategoryKey` and the object’s shape for `sun`, `water`, `spacing`, `germination`.
- **Category keys vs database:** There is **no** `category` column on `plant_varieties`. Category is derived from the plant **name** (e.g. “Cherry Tomato” → “Tomato”) only for applying defaults in the scraper. So there is no DB enum or column to align with; category keys are name‑based lookup only. No mismatch.

---

## 4. Supabase RLS Review (plant_varieties)

- **Critical finding:** In the migrations reviewed (`20250204000000` through `20250205500000`), **Row Level Security is never enabled on `plant_varieties`**. RLS is enabled on `grow_instances`, `tasks`, `journal_entries`, `shopping_list`, `seed_stocks`, and storage; `plant_varieties` has no `ENABLE ROW LEVEL SECURITY` and no policies.
- **Impact:** With the anon key, any authenticated user can:
  - **SELECT** any row by `id` (e.g. `/vault/[id]` with another user’s id).
  - **UPDATE** any row by `id`: vault detail page uses `.update(updates).eq("id", id)` and `.update(auditUpdates).eq("id", id)` with no `user_id` filter; QuickAddSeed uses `.update(updates).eq("id", existing.id)` when updating an existing seed. So a user could change another user’s plant data if they know the id.
- **Insert:** New plants are created with `user_id: effectiveUserId`, so ownership is set at creation, but without RLS that row is then readable/updatable by others.
- **Recommendation:** Add RLS to `plant_varieties`: `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)` for SELECT/INSERT/UPDATE/DELETE so the app cannot read or update another user’s plants even if the client sends another id.

---

## 5. UI/UX Consistency (QuickAddSeed vs existing inputs)

- **Big 4 in Quick Add:** QuickAddSeed does **not** expose the “Big 4” fields (sun, plant_spacing, days_to_germination, harvest_days). It only has: Plant Name, Variety/Cultivar, Vendor, Volume, and (in Import flow) source URL and tags. So there are no Big 4 inputs to compare for styling.
- **Existing Quick Add inputs:** Labels use `block text-sm font-medium text-black/80 mb-1`; inputs use `w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald`. This matches the vault detail edit styling pattern (rounded-xl, same focus ring). If Big 4 are added to Quick Add later, reuse this same input class set for consistency.

---

# Categorized summary

## Critical Fixes (Immediate action needed)

| # | Item | Location | Action |
|---|------|----------|--------|
| 1 | **plant_varieties has no RLS** — any user can read/update any plant by id | Supabase migrations | Add a new migration: `ALTER TABLE plant_varieties ENABLE ROW LEVEL SECURITY;` and create policies so SELECT/INSERT/UPDATE/DELETE are allowed only when `auth.uid() = user_id`. |
| 2 | **Vault and Quick Add updates do not filter by user_id** — rely on RLS for safety | `vault/[id]/page.tsx`, `QuickAddSeed.tsx` | After RLS is in place, optionally add `.eq("user_id", user.id)` to updates for defense-in-depth and clearer intent; RLS remains the enforcement. |

---

## Optimizations (To improve speed/reliability)

| # | Item | Location | Action |
|---|------|----------|--------|
| 1 | **Scrape timeout is 15s** — if spec is 10s, align code or spec | `scrape-url/route.ts` | Either set `SCRAPE_TIMEOUT_MS = 10_000` and keep AbortController + Promise.race at 10s, or document that 15s is intentional. |
| 2 | **Timeout timer never cleared when scrape wins** — minor timer leak | `scrape-url/route.ts` | Build `timeoutPromise` with a stored timer id and clear it when `scrapePromise` wins (e.g. wrap race in a finally or resolve handler that clears the timeout). |
| 3 | **Full HTML in memory** — large pages can spike memory | `scrape-url/route.ts` | Consider a response size cap (e.g. abort or reject if `Content-Length` or body exceeds a threshold) or streaming/chunked parsing if a parser supports it, to avoid OOM on very large vendor pages. |

---

## Future Tech Debt (Things to fix later)

| # | Item | Location | Notes |
|---|------|----------|--------|
| 1 | **Duplicate ownership check** | Vault detail, Quick Add | After RLS is added, consider keeping a single source of truth (RLS only) vs. also adding `.eq("user_id", user.id)` in the client for clarity and earlier 0-row feedback. |
| 2 | **Centralize scrape timeout constant** | `scrape-url/route.ts` | If other routes (e.g. proxy-image) need the same limit, move `SCRAPE_TIMEOUT_MS` to a shared constant. |
| 3 | **Error message i18n** | Vault, Quick Add, scrape API | User-facing strings are hardcoded; consider keys for future localization. |
| 4 | **Big 4 in Quick Add** | `QuickAddSeed.tsx` | If product adds sun/spacing/germination/harvest_days to Quick Add, reuse the same input classes as vault detail for consistency. |

---

*End of QC Audit Log*
