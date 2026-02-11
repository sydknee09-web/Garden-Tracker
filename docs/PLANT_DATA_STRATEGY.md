# Plant Profile Data Strategy

## Why scraping + AI keeps failing

1. **Vendors block or change pages** → 403/404, layout changes, or bot detection.
2. **Unknown category** → We only had ~15 categories; Bean, Beet, Cucumber, Sweet Pea were missing, so every unknown fell back to `"Tomato"` in the AI prompt (e.g. "Painted Lady Organic Bean **Tomato**").
3. **AI is only as good as the input** → Wrong category + noisy names (e.g. "Floret Shop - Floret Flowers") → bad Tavily results.

## Current flow (after this pass)

1. **Category defaults first** – `PLANT_CATEGORY_DEFAULTS` (in `src/constants/plantDefaults.ts`) is the first source of truth. We expanded it with Bean, Beet, Cucumber, Sweet Pea.
2. **On 403/404** – We derive plant name from the URL. If we can resolve a **known category** from that name, we **return category defaults immediately** (no Tavily). Only when the category is unknown do we call AI.
3. **Scrape when the page loads** – For title, image, description. If that fails, we still have specs from category.
4. **AI only for unknown categories** – e.g. a plant we don’t have a category for yet.

## Better long-term: variety-level database

A **curated plant/variety table** gives one source of truth and avoids repeated scraping/AI for the same kinds of plants.

### Option A: Supabase table `plant_specs`

- **Columns (example):** `id`, `normalized_name` (or `slug`), `category`, `sun`, `water`, `plant_spacing`, `days_to_germination`, `harvest_days`, optional `latin_name`, `notes`.
- **Lookup:** When we have a plant name (from URL or scrape), normalize it (e.g. "Painted Lady Organic Bean" → "painted-lady-bean" or keep "Bean" + fuzzy match). Query `plant_specs` by `normalized_name` or by `category` + name.
- **Flow:** URL → derive name → **lookup in `plant_specs`** → if found, use those specs and mark source as `database`. Else → category defaults. Else → scrape/AI.
- **Seeding:** Populate from a one-time CSV, from successful scrapes, or from a public dataset (e.g. USDA, seed companies’ open data).

### Option B: Static JSON / module

- Same idea as Option A but a JSON file or TS constant (e.g. `varietySpecs.json`) that you edit by hand or generate from a spreadsheet. No DB migration; good for a small set of varieties.

### Recommendation

- **Short term:** Rely on expanded category defaults + “category known → no Tavily” (already in place). Add categories to `plantDefaults.ts` as you run into new plant types.
- **When you have 50+ varieties or want per-variety accuracy:** Add `plant_specs` (or similar) in Supabase, implement lookup in the scrape route before category defaults, and backfill from your best existing data or a CSV.

This way, **database (or curated data) is first**, scraping is for metadata only, and AI is a last resort for truly unknown plants.
