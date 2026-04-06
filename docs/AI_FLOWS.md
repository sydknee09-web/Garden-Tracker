# AI Flows: New Plant Profiles and Fill Empty Cells

**Reference for when and how AI (Gemini + Search) is used for plant profile creation and filling empty fields.** When adding new "add packet" or "add profile" entry points, ensure consistency with these flows (see Audit section below).

---

## 1. New plant profile when adding for a new variety

New profiles are **not** created by a dedicated AI; they are created by normal DB inserts when the user adds a packet or plant for a **name+variety that does not match an existing profile**. AI is used (1) **before** the profile exists to supply data (extract from photo/URL, scrape), or (2) **after** the profile is created to fill empty fields (enrich + hero).

| Entry point | Profile creation | When AI runs |
|-------------|------------------|--------------|
| **Batch Add (photo)** | Match by name+variety; if no match, insert with extract data + zone10b + tags | Before: `/api/seed/extract` (Gemini vision + optional research). **After create:** fill-blanks-for-profile fired in background for each new profile ID. |
| **Quick Add (manual new variety)** | `buildProfileInsertFromName` → insert → `enrichProfileFromName` | After create: enrich-from-name + find-hero-photo (Gemini + Search). |
| **Add Plant Modal** | Same as Quick Add | Same as Quick Add. |
| **Vault Plant page (sow)** | Same as Quick Add for new variety rows | Same as Quick Add. |
| **URL Import** | Scrape URL → if no match, insert profile with scrape + zone10b → insert packet | Before: scrape-url (HTML + optional Gemini per vendor). **After create:** fill-blanks-for-profile fired in background only when scrape has &lt; 40% of key fields (saves AI tokens when URL is already data-rich). |
| **Review Import save** | Save builds/updates profiles from extracted data; collects `newProfileIds` | After save: fill-blanks-for-profile (useGemini: true) for each new profile ID (background). |
| **Batch-import API** | Per URL: scrape-url → match or create profile → insert packet | No fill-blanks in this route. |

---

## 2. Fill empty cells in a plant profile

**Entry points:**

- **Vault profile detail:** "Fill empty cells" or "Overwrite with AI" → POST `/api/seed/fill-blanks-for-profile` (useGemini / overwrite).
- **Review Import:** After save, one POST per new profile ID to fill-blanks-for-profile (with `backgroundEnrich: true` for observability).
- **Batch Add / URL Import:** After creating new profiles, fire fill-blanks in background with `backgroundEnrich: true`.
- **Settings → Developer:** Bulk "Fill in blanks" → POST `/api/settings/fill-in-blanks` (same cache + optional Gemini; can stream).

**Flow (single profile: `/api/seed/fill-blanks-for-profile`):**

1. **Cache:** `getBestCacheRow` (global_plant_cache by identity_key, purchase_url, vendor). `buildUpdatesFromCacheRow` builds updates for **empty** profile fields only. If `overwrite: true`, cache is skipped.
2. **Apply cache** to plant_profiles (never overwrite non-empty unless overwrite).
3. **Optional AI** (when useGemini and still missing hero/description, or overwrite): call **find-hero-photo** (Gemini + Search for image; caches; may download/compress to storage) and **enrich-from-name** (global_plant_library then **researchVariety** = Gemini + Google Search). Results applied to profile; enrich data may be written to global_plant_cache.

**Shared primitives:**

- **researchVariety** (`src/lib/researchVariety.ts`): Gemini 2.5 Flash + Google Search; used by extract (research pass), enrich-from-name, fill-blanks, backfill scripts.
- **find-hero-photo** (`src/app/api/seed/find-hero-photo/route.ts`): Cache tiers then Gemini + Search for hero image; used by fill-blanks, enrichProfileFromName, extract (link), background-hero-for-profile.

**Observability:** When fill-blanks is triggered from Batch Add, URL Import, or Review Import (post-create), callers send `backgroundEnrich: true` in the body. The API logs these with `logRequestMetrics(routeId: 'background-enrich', durationMs, statusCode)` for Vercel log streams.

---

## 3. Consistency rule for new entry points

When adding a new flow that **creates a new plant profile** (e.g. new "add packet" path):

- Either call **enrichProfileFromName** after the insert (like Quick Add / Add Plant / Plant page), or
- Fire **fill-blanks-for-profile** with `useGemini: true` (and `backgroundEnrich: true` for observability) in the background for each new profile ID (same pattern as Batch Add, URL Import, Review Import).

This keeps photo-added and URL-imported varieties on par with manual Quick Add for post-create fill.

For **URL-based imports**, only trigger background fill-blanks when the scrape has **&lt; 40%** of key fields (sun, plant_spacing, days_to_germination, harvest_days, plant_description, growing_notes) to avoid unnecessary AI calls when the source URL is already data-rich. Use a `shouldEnrichFromScrape(scrapeData)`-style check (see `src/app/vault/import/page.tsx`).

---

## Audit

A full audit of both AI processes is in the plan **AI profile creation and fill-blanks audit** (see `.cursor/plans/` or conversation history). It documents entry points, data flow, cache vs AI, and the implementation of firing fill-blanks after Batch Add and URL Import (with 40% scrape check for URL Import and `backgroundEnrich` observability).
