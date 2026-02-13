# Import Parity Plan — Addendum: Link Import as Source of Truth

## Your context

- **Link import is the reference implementation.** You invested the most in it and added vendor-specific rules so each URL style is treated correctly for name, variety, and plant.
- **Hero image** flow is not perfectly “clean” but the output was working well; any changes should be additive, not a rewrite.
- **Photo import and cache** should produce the same standardized output as link import, not the other way around.

---

## Vendor URL patterns (preserved)

Different vendors use different URL and page structures. The existing rules in the codebase must stay as-is:

| Vendor | Example URL | How name/variety/plant are derived |
|--------|-------------|-------------------------------------|
| **Renee's Garden** | `reneesgarden.com/collections/herbs/products/basil-container-organic-spicy-globe` | Title-driven: first word of page title → plant (e.g. Basil), rest → variety (e.g. Spicy Globe). Slug has category-plant-variety style. |
| **Territorial Seed** | `territorialseed.com/products/fire-starter?variant=47311316877486` | Product slug is variety-like (e.g. "fire-starter"); page may show "Flower \| crocosmia" so plant comes from page content/type, not slug. |
| **Rare Seeds** | `rareseeds.com/zinnia-seeds-benary-s-giant-white` | Slug contains plant + variety (e.g. zinnia, Benary's Giant White). Often 403-blocked; slug + rescue used to get identity; hero via find-hero-photo. |

Other vendors (Johnny's, San Diego Seed Co, Outside Pride, Hudson Valley, Floret, etc.) have their own rules in [SEED_RULES.md](SEED_RULES.md) and [extract-metadata](src/app/api/seed/extract-metadata/route.ts) (title-priority hosts, plant-from-URL, vendor overrides). **None of that is removed or simplified.**

---

## Plan adjustments

1. **Link import pipeline = unchanged.**  
   - Keep all steps in extract-metadata (HTML entity decode, vendor overrides, blocked tags, generic flower inference, host-specific rules for Renee's, Outside Pride, San Diego, Johnny's, strip plant from variety, catalog number strip, Hudson Valley, title-priority, cleanVarietyForDisplay, generic trap, hero from page).  
   - Keep extract-rescue and find-hero-photo behavior for link import as-is.  
   - Any “unification” means: **photo import and cache output are normalized to match this link-import output shape**, not that we replace or generalize the link logic.

2. **Hero image.**  
   - Current link-import hero flow (cache checks, then AI search with multiple passes) stays.  
   - Improvements are **additive only**: e.g. optionally check `global_plant_cache` for a hero URL by identity when available, and make “detailed then loosen” (Vendor+Plant+Variety → Plant+Variety) explicit. No rewrite of the existing working behavior.

3. **Photo import and “lookup by identity”.**  
   - Photo path should apply the **same** display normalization as link (stripPlantFromVariety, cleanVarietyForDisplay) so variety/name/tags match.  
   - If we add “lookup by identity” for photo, the **returned shape** should match what extract-metadata returns (so it’s a drop-in cache hit), and the **identity_key** format should align with what link import uses (so bulk-scrape and cache use the same key).  
   - We do **not** push link import toward a “generic” extract; we push photo and cache toward the link-import standard.

4. **Bulk-scrape / global_plant_cache.**  
   - When scraping vendor URLs, we still need vendor-specific handling (e.g. scrape-url or whatever feed bulk-scrape uses).  
   - Normalization (so cache has same type/variety/identity shape as link import) is applied **after** we have raw scraped data, so we don’t lose vendor-specific parsing.

---

## Plant description on the plant profile

You want a **plant description** on the plant profile. Here’s what exists today and what’s needed.

### Current state

- **Scrape-url** already extracts `plant_description` for supported vendors (Rare Seeds, Johnny’s, Territorial, Renee’s, Burpee, Hudson Valley, San Diego, Floret, etc.) from product-page HTML (e.g. `div.product-description`, `og:description`, vendor-specific selectors). So the **data is available** when we use the scrape path.
- **Bulk-scrape** stores that in `global_plant_cache.extract_data.plant_description`, so **link import can get description on cache hit** (Tier 0) if we pass it through.
- **Link import (extract-metadata)** today returns `ExtractResponse`, which does **not** include `plant_description`. When the response is built from cache, we could add `plant_description` from `extract_data`; when it’s from **AI (extractFromUrl)**, the Gemini prompt does not ask for a description, so we don’t get one on cache miss.
- **plant_profiles** (main table) does **not** have a `plant_description` column. The legacy table `plant_varieties` does (migration `20250205300000_plant_varieties_plant_description.sql`). The profile detail page ([vault/[id]/page.tsx](src/app/vault/[id]/page.tsx)) only shows description for legacy profiles (`legacyPlantDesc`).
- **Review import** does not have `plant_description` on `ReviewImportItem`, and **Save All** does not write it to the profile.

### What to do

1. **Schema:** Add `plant_description text` to `plant_profiles` (migration), and add it to the `PlantProfile` type and to the profile select/display on the vault profile page.
2. **Link import (cache hit):** In extract-metadata, when returning a response from Tier 0 or Tier 1 cache, include `plant_description` from `extract_data` in the JSON so the client and review flow receive it.
3. **Review flow:** Add `plant_description?: string` to `ReviewImportItem`; when building review items from link import, set it from the extract-metadata response. In **Save All**, when creating or updating a profile, set `plant_description` from the item (if present).
4. **Profile page:** Select `plant_description` for `plant_profiles` and show it in the profile UI (same idea as legacy “Plant Description”).
5. **When we don’t have description (cache miss or photo import):**  
   - **Option A:** Add to the **extractFromUrl** (and optionally **researchVariety**) Gemini prompt: ask for a short “plant_description” (1–3 sentences: appearance, use, key traits). Then include it in the API response and review item. That way link-import cache miss and photo import can still get a description.  
   - **Option B:** Leave description only from cache/scrape (so it’s only present when we have scraped or cached data).  
   Recommendation: **Option A** so every profile can have a description when we have at least name/variety (AI can generate a brief one).

After this, plant description will be stored on the profile and shown on the profile page; link import will populate it from cache or (if we add the prompt) from AI; photo import will get it from research/AI if we add it to the research prompt.

---

## Summary

- **Link import:** Keep all vendor-specific rules and hero behavior; it remains the source of truth for “correct” name, variety, plant, and output format.  
- **Photo import & cache:** Align to link-import output and identity; add cache-by-identity and hero-from-global-cache only as additive improvements.  
- **Hero:** Additive improvements only; preserve existing working flow.  
- **Plant description:** Add column to plant_profiles; pass through from cache and (optionally) from AI in extract/research; save on review and display on profile page.
