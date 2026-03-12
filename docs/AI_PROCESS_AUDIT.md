# AI Process Audit — How the AI Pipeline Works

This document describes the AI-related entry points, APIs, libraries, data flow, and consistency in the Seed Vault app. Use it for onboarding, debugging, and planning (e.g. overwrite flow, single-SDK migration).

---

## 1. Entry points (who calls AI)

| Entry point | What runs | APIs / libs used |
|-------------|-----------|-------------------|
| **Plant profile — Fill blanks (✨)** | Fill hero + description/growing notes from cache or AI | `fill-blanks-for-profile` → `find-hero-photo`, `enrich-from-name`; cache: `global_plant_cache` |
| **Plant profile — Magic Fill (Care tab)** | Generate care schedule suggestions | `recommend-care-tasks` (Gemini); writes `care_schedule_suggestions` |
| **Import by URL (vault/import)** | Scrape product page, then optional hero | `scrape-url`; then `find-hero-photo` for items missing hero |
| **Review import (vault/review-import)** | Save selected items; fill blanks after save | `find-hero-photo` (phase 0 for hero); `fill-blanks-for-profile` after save |
| **Manual add (vault/import/manual)** | Create profile from name/variety | `enrich-from-name`, `find-hero-photo` |
| **Import photos / hero (vault/import/photos, hero)** | Find or upload hero image | `find-hero-photo` |
| **Batch import (API)** | Bulk scrape URLs | Calls `scrape-url` internally |
| **Extract rescue / re-extract** | Re-run extraction for a URL | `scrape-url` (canonical), then AI rescue |
| **Settings — Fill in blanks** | Backfill many profiles from cache/AI | `fill-in-blanks` route → `enrich-from-name`, `find-hero-photo` |
| **Developer — backfill, hero, etc.** | One-off hero or backfill | `find-hero-photo`, `fill-blanks-for-profile`, etc. |
| **Supply shed — enrich from name** | Enrich supply profile by name | `supply/enrich-from-name` (Gemini) |
| **Supply — extract from URL/photo** | Extract supply metadata from URL or image | `supply/extract-from-url`, `supply/extract-from-photo` |
| **Client lib** | `enrichProfileFromName` (e.g. manual add) | Calls `enrich-from-name`, `find-hero-photo`; applies updates client-side |

---

## 2. APIs and server-side AI

| Route | Purpose | Gemini usage | SDK |
|-------|---------|--------------|-----|
| `POST /api/seed/scrape-url` | Scrape product page + extract metadata (name, variety, sun, spacing, etc.) | Yes (fallback after fetch) | `@google/generative-ai` |
| `POST /api/seed/find-hero-photo` | Find a hero image URL for a plant (name/variety). Tiers: cache (global_plant_cache, seed_import_logs, storage), then Gemini image search | Yes (Tier 4) | `@google/genai` |
| `POST /api/seed/enrich-from-name` | Enrich plant metadata from name/variety (sun, water, description, growing_notes, propagation, companion, etc.) | Yes | `@google/genai` (researchVariety) |
| `POST /api/seed/recommend-care-tasks` | Generate care schedule suggestions (fertilize, prune, etc.); writes to `care_schedule_suggestions` | Yes | `@google/genai` |
| `POST /api/seed/fill-blanks-for-profile` | Single-profile fill: cache first (global_plant_cache), then optional hero + enrich. Writes hero to cache via find-hero; writes enrich to global_plant_cache | Calls find-hero-photo + enrich-from-name internally | — |
| `POST /api/seed/extract` | Extract from URL (legacy/alternate path) | Yes | Both `generative-ai` and `genai` |
| `POST /api/seed/extract-metadata` | Canonical extractor for link import; uses scrape-url | Via scrape-url | — |
| `POST /api/seed/extract-order` | Order parsing | Yes | `@google/generative-ai` |
| `POST /api/seed/re-extract-url` | Re-run scrape for a URL | Calls scrape-url | — |
| `POST /api/seed/extract-rescue` | Rescue metadata; scrape-url then AI | Via scrape-url | — |
| `POST /api/settings/fill-in-blanks` | Batch fill many profiles | Calls enrich-from-name, find-hero-photo | — |
| `POST /api/seed/background-hero-for-profile` | Server-side hero fetch for a profile | Calls find-hero-photo | — |
| `POST /api/supply/enrich-from-name` | Enrich supply profile by name | Yes | `@google/genai` |
| `POST /api/supply/extract-from-url` | Extract supply from URL | Yes | `@google/genai` |
| `POST /api/supply/extract-from-photo` | Extract supply from image | Yes | `@google/generative-ai` |
| `POST /api/supply/extract-order` | Parse order from image | Yes | `@google/generative-ai` |

---

## 3. Client-side / libs

| File | Role |
|------|------|
| `src/lib/enrichProfileFromName.ts` | Calls `enrich-from-name` and `find-hero-photo`; applies updates to profile (fill-only for growing_notes unless overwrite). Used by manual add and potentially fill-blanks UI. |
| `src/lib/researchVariety.ts` | Used by enrich-from-name and extract; calls `@google/genai` for research. |
| `src/lib/fillBlanksCache.ts` | Builds profile updates from `global_plant_cache` row; used by fill-blanks-for-profile and settings fill-in-blanks. |
| `src/lib/identityKey.ts` | Canonical identity key for plant (name + variety); used by find-hero-photo, enrich, lookup-by-identity, cache keys. |

---

## 4. Data flow (cache vs live AI)

- **Hero image:** `find-hero-photo` checks: Tier 0.5 global_plant_cache → Tier 2 plant_extract_cache (storage path / original_hero_url) → Tier 3 seed_import_logs → Tier 4 Gemini. Results written to cache (e.g. plant_extract_cache, seed_import_logs) and/or returned to caller.
- **Enrich (description, growing_notes, propagation, companion, etc.):** `enrich-from-name` uses `researchVariety` (Gemini). `fill-blanks-for-profile` first tries `global_plant_cache`; if missing or overwrite, calls enrich-from-name and writes result to `global_plant_cache`.
- **Care suggestions:** `recommend-care-tasks` calls Gemini, writes to `care_schedule_suggestions`; user approves/rejects; approved become `care_schedules` (templates).
- **Scrape / extract:** `scrape-url` fetches URL, then uses Gemini to extract metadata; result can be written to cache (e.g. for link import).

---

## 5. Consistency and conventions

- **Identity key:** Same format everywhere (`identityKeyFromVariety(type, variety)` / name+variety) for cache lookups and hero/enrich.
- **API usage logging:** `logApiUsageAsync({ userId, provider: "gemini", operation: "…" })` used in find-hero-photo, enrich-from-name, recommend-care-tasks, scrape-url, supply enrich. Not every AI path may log (e.g. internal fetch from fill-blanks uses token, so find-hero-photo logs).
- **Auth:** All API routes that call AI should use `getSupabaseUser(req)` or equivalent; token forwarded for internal fetch so cache and RLS work.

---

## 6. Errors and limits

- **Timeouts:** `fill-blanks-for-profile` has `maxDuration = 60`. Other routes may use default or smaller limits.
- **Rate limits:** No app-level rate limiting documented; Gemini API key limits apply.
- **Error handling:** Many routes log with `logApiError("operation", e)` and return 500 or 200 with `{ error: "…" }`. Client-side `enrichProfileFromName` does not overwrite on error; fill-blanks may partial-apply.
- **Overwrite:** Today fill-blanks and enrich are fill-when-empty only. Plan: add `overwrite: true` to fill-blanks-for-profile to force re-run AI and overwrite existing fields (with confirmation in UI).

---

## 7. Dual Gemini SDK (Outstanding Audit #10)

- **`@google/generative-ai`** (older): used in scrape-url, extract, supply extract-from-photo, supply extract-order, importPdfCatalog.
- **`@google/genai`** (newer): used in find-hero-photo, enrich-from-name, recommend-care-tasks, researchVariety, supply enrich-from-name, supply extract-from-url.
- Migrating everything to `@google/genai` and removing `@google/generative-ai` will reduce bundle size and simplify maintenance.

---

## 8. Documentation gaps

- No single diagram of “user taps Fill blanks → fill-blanks-for-profile → cache vs find-hero + enrich”.
- Overwrite flow (B2) not yet implemented; when added, document in this file and in API route comments.
- Which fields each API reads/writes (e.g. global_plant_cache columns) is in code; a short “cache schema and field mapping” section could be added here later.

---

*Last updated: March 2026. Update this doc when adding or changing AI entry points, APIs, or cache behavior.*
