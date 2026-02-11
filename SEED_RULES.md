# Seed Extract Flow & Order of Operations

Single reference for how link import runs and how type/variety/vendor are set. **Update this file whenever you add or reorder steps** in the extract pipeline.

---

## Extract Flow (Link Import)

1. **Pass 1 — extract-metadata**  
   Client calls `POST /api/seed/extract-metadata` with `url`.  
   - Fetches product page (unless blocked vendor) and runs AI link extraction (`extractFromUrl`).  
   - Returns `{ type, variety, vendor, ... }` with `failed: false`, or `failed: true` + `triggerAiSearchForName` when variety is generic trap / junk / missing.

2. **Client handling of Pass 1**  
   - 404 → link dead.  
   - 403/429 → retry once; for Rare Seeds 403, build synthetic result (slug as variety) and mark `needsRescue: true` so Pass 2/3 run.  
   - If `failed: true` or no result → item is included in Pass 2 rescue list.

3. **Pass 2 — rescue**  
   For indices where Pass 1 returned `failed: true` or `triggerAiSearchForName`, client calls `POST /api/seed/extract-rescue` with the same URL.  
   - Rescue uses URL slug + domain and AI search to fill type/variety/vendor.  
   - Result is merged back into the same item for Pass 3.

4. **Pass 3 — hero photo**  
   For items that don’t already have a product-page image, client calls `POST /api/seed/find-hero-photo` (or equivalent) to get a hero image.  
   - Rare Seeds: often run Pass 3 even when Pass 1 had no image (403 block).  
   - Phase 0 (Vault) is checked first when `identity_key` + auth are sent.  
   - **Operational:** Status 0 or 403 in Import Logs usually means the vendor blocked the request; we still use a cached hero from the Vault (Phase 0) when one exists for that `identity_key`.

5. **Review & save**  
   Results are turned into review items (identity key from type + variety), then user can edit and save to vault.

---

## Order of Operations (extract-metadata, when `result` exists)

Applied in **this order** inside `if (result)` in `src/app/api/seed/extract-metadata/route.ts`. Insert new steps in the right place to avoid breaking existing behavior.

| # | Step | What it does |
|---|------|----------------|
| 1 | **Decode HTML entities** | `result.vendor`, `result.type`, `result.variety` through `decodeHtmlEntities` so no `&#41;` etc. in output. |
| 2 | **Vendor overrides (Rare Seeds)** | If URL contains `rareseeds.com` → `result.vendor = "Rare Seeds"`. |
| 3 | **Blocked tags** | `result.tags` filtered by user blocked_tags. |
| 4 | **Generic flower inference** | If `result.type` is generic flower (`"flower"`, `"flower seed"`, `"flowers"`, or starts with `"flower"` and length ≤ 20), run `inferSpecificPlantFromVariety(result.variety)` and, if non-null, set `result.type` to that (e.g. Celosia, Plectranthus). |
| 5 | **Host** | Compute `host` from URL for later steps. |
| 6 | **Renee's Garden** | If `reneesgarden.com` and `titleFromPage`: first word of title → `result.type` (if missing), rest → `result.variety` (if missing). |
| 7 | **Outside Pride / San Diego Seed Co** | If host is `outsidepride.com` or `sandiegoseed`: set `result.type` from `plantFromSegmentBeforeProduct(url)` when non-empty; if that segment is generic (e.g. Silver, Ornamental), use `plantFromProductSlug(url)` instead (first part of product slug, e.g. "Plectranthus"). Else (Outside Pride only) from `plantFromUrlSlug(url)` when type still empty. |
| 7.5 | **Generic flower + URL segment** | If `result.type` is still generic flower (e.g. "Flower", "Flower Seed") after Step 7, set `result.type` from `plantFromSegmentBeforeProduct(url)` when the segment is not generic (e.g. `sweet-pea` → "Sweet Pea"). Ensures Step 8 has a specific plant name when the variety didn't contain it. |
| 8 | **Strip plant from variety (boundary-only)** | `result.variety = stripPlantFromVariety(result.variety, result.type)` — removes plant only as prefix or suffix (with "Seed(s)" noise ignored at end). **Multi-word plants** (e.g. Sweet Pea, Snap Dragon): the logic must match the **entire phrase** at the start or end of the variety, not a single word. Do not use a first-word-only or last-word-only check; this ensures "Sweet Pea High Scent" with plant "Sweet Pea" becomes "High Scent" and future changes don't revert to single-word matching. |
| 9 | **Catalog number strip** | `result.variety` trailing `\s+\d{3,4}` removed (e.g. Fedco "249"). |
| 10 | **Hudson Valley vendor** | If host contains `hudsonvalleyseed` → `result.vendor = "Hudson Valley Seed Co"`. |
| 11 | **Title-priority hosts (Johnny's, Outside Pride, San Diego)** | If `titleFromPage` is generic trap → return `failed: true` + `triggerAiSearchForName`. If not junk, `result.variety = titleFromPage`; else if variety is junk or empty → same early return. |
| 11.5 | **Final scrub (strip plant from variety)** | `result.variety = stripPlantFromVariety(result.variety, result.type)` again so that after any vendor/title override, variety never starts or ends with the plant name. Ensures e.g. "Sweet Pea Antique Cup" → "Antique Cup". |
| 12 | **cleanVarietyForDisplay** | `result.variety` and tags updated from `cleanVarietyForDisplay(result.variety, result.type)` (suffix strip, F1/Heirloom/Hybrid tags, last-word plant dedupe). |
| 13 | **Generic trap / junk variety** | If `result.variety` is generic trap or junk title → return `failed: true` + `triggerAiSearchForName` or use slug variety. |
| 14 | **Hero image from page** | If `pageResult` has `imageUrl`, set `result.hero_image_url` and `result.stock_photo_url`. |
| 15 | **Return** | Return `result` with `failed: false` and `productPageStatus`. |

If `result` is null (e.g. extract timeout), API falls back to `varietySlugFromUrl` + `vendorFromUrl` and returns `failed: true` with that fallback.

---

## Vendor rules (plant from URL & vendor name)

When adding a new vendor, add a row here and use the same pattern in code. **Plant from URL** = which function sets `result.type` from the URL; **Vendor name** = override so display is consistent.

| Host | Plant from URL | Vendor name | Other |
|------|----------------|-------------|--------|
| **rareseeds.com** | — (AI + rescue; rescue uses URL slug as variety when 403) | Always **"Rare Seeds"** (extract-metadata + `vendorFromUrl` in extract route) | 403 → synthetic result with slug as variety; Pass 3 hero runs. |
| **reneesgarden.com** | — (title-driven) | From AI / page | First word of **page title** → type (if missing); rest of title → variety (if missing). No URL plant function. |
| **outsidepride.com** | **plantFromSegmentBeforeProduct(url)** first; if that segment is generic (e.g. Silver), **plantFromProductSlug(url)** (first part of product slug). If still empty, **plantFromUrlSlug(url)**. | From AI / `vendorFromUrl` | Title-priority host: page title can override variety. |
| **sandiegoseed** (San Diego Seed Co) | **plantFromSegmentBeforeProduct(url)**; if segment generic (e.g. Silver), **plantFromProductSlug(url)**. No fallback to first path segment. | From AI / `vendorFromUrl` | Title-priority host. |
| **hudsonvalleyseed** | — | Always **"Hudson Valley Seed Co"** (extract-metadata + `vendorFromUrl` in extract route) | No plant-from-URL; type/variety from AI + pipeline. |
| **superseeds.com** | — | From AI / `vendorFromUrl` | No type/vendor override. Has **custom image selector** in product page fetch (extract-metadata) when og:image missing. |
| **johnny** (Johnny's) | — | From AI / `vendorFromUrl` | Title-priority host only; no plant-from-URL. |
| **floretflowers.com** (e.g. shop.floretflowers.com) | — | Always **"Floret"** (extract-metadata + `vendorFromUrl` in extract route) | Subdomain "shop" would otherwise show as vendor; override so display is "Floret". |

**Functions (extract route):**

- **plantFromSegmentBeforeProduct(url)** — Path segment immediately before the last segment (product slug), title-cased. Example: `.../plectranthus/plectranthus-silver-crest.html` → `"Plectranthus"`.
- **isGenericSegmentForPlant(segment)** — True when segment is a known category/color (Silver, Ornamental, Flower, etc.) so we prefer **plantFromProductSlug(url)**.
- **plantFromProductSlug(url)** — First part of the product slug (last path segment before extension), title-cased. Example: `.../plectranthus-silver-crest.html` → `"Plectranthus"`. Used when segment-before-product is generic.
- **plantFromUrlSlug(url)** — First path segment, strip `-seed`/`-seeds`, title-cased. Example: `/fruit-seed/` → `"Fruit"`.
- **vendorFromUrl(url)** — Uses `VENDOR_NORMALIZE_MAP` (rareseeds.com → "Rare Seeds", hudsonvalleyseed → "Hudson Valley Seed Co", floretflowers.com → "Floret"); else first domain segment title-cased.

---

## Where type/variety come from

- **Pass 1**: AI (`extractFromUrl`) + page title + the steps above.  
- **Pass 2 (rescue)**: `extract-rescue` uses URL slug + AI search; its output is merged into the same item; no second run of the extract-metadata order of operations.  
- **Identity key**: Built from **type** and **variety** after the pipeline (and any client-side cleaning). Same key is used for Phase 0 (Vault) and dedupe.

Keep this doc in sync when adding vendors or reordering steps.
