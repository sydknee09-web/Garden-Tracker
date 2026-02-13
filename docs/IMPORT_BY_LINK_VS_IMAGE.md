# Import by Link vs Import by Image — Exact Process

This doc walks through the **exact** steps each flow takes to build a plant profile (and packets) in the Seed Vault.

---

## Standardized format, identity key, and cache strategy

**Format:** Both link and photo flows use the same normalization pipeline so type/variety/tags are consistent. Plant (name/type) is one canonical name; variety is cleaned only (no plant name prefix/suffix, no "F1"/"Organic"/"Heirloom" in the string — those live in tags). The extract route **image branch** applies `stripPlantFromVariety` and `cleanVarietyForDisplay` before returning; link import does the same in extract-metadata. Shared helpers live in `src/lib/varietyNormalize.ts` and `src/lib/identityKey.ts`.

**Identity key:** A single format is used everywhere: `getCanonicalKey(type)_getCanonicalKey(strippedVariety)` (alphanumeric only, e.g. `tomato_cherokeepurple`). It is used in link import, photo import, bulk-scrape, find-hero-photo, and lookup-by-identity so cache lookups by identity match across flows.

**Cache strategy:**
- **Link:** Cache-first by `source_url`: Tier 0 (`global_plant_cache`) → Tier 1 (`plant_extract_cache`) → fetch + AI. No change to this path.
- **Photo:** There is no URL for a photo, so Tier 0/1 by URL do not apply. After the extract (image) response returns type/variety, the app can call **`POST /api/seed/lookup-by-identity`** with normalized identity (and optional vendor). On hit, the cached payload (including hero and specs) is used and find-hero-photo is skipped. On miss, the app runs the usual extract + research + find-hero-photo. **find-hero-photo** also checks `global_plant_cache` by `identity_key` for a hero URL (Tier 0.5) before running AI search.

**Photo and cache:** Photo review items have **`identityKey`** set (from the same formula above). On Save All, **`plant_extract_cache`** is upserted with a **synthetic** `source_url` when the item has no URL (e.g. `photo:${identityKey}`), so the same user benefits on re-import (find-hero-photo and lookup-by-identity can reuse that user’s cached data).

---

## 1. Import by link (paste URLs)

**Entry:** Vault → “Add” / “Import by link” → `/vault/import` → paste one or more URLs → **Start Import**.

### Step-by-step

1. **Parse URLs**  
   `parseUrls(urlText)` splits on newlines, trims, and ensures each line has `https://`. Each URL becomes one import item.

2. **Pass 1 — Metadata / identity (per URL, in chunks of 3)**  
   For each URL the app calls **`POST /api/seed/extract-metadata`** with `{ url, batchIndex, batchTotal, isFirstInBatch, skipProductPageFetch? }`.
   - **Blocked vendors** (e.g. rareseeds.com): `skipProductPageFetch: true` so the product page is not fetched (avoids 403).
   - **Caches (optional):**
     - **Tier 0:** `global_plant_cache` by `source_url`. Hit → return cached `extract_data` + hero URL; no fetch, no AI.
     - **Tier 1:** `plant_extract_cache` by `user_id` + `source_url`. Hit → return cached extract + hero (or stored path).
   - **On cache miss:**
     - **Product page fetch** (unless skipped): `productImageFromPage(url)` fetches the HTML (realistic User-Agent, 8s timeout), extracts:
       - Page title (og:title → main `<h1>` → `<title>` stripped of vendor suffix), rejecting junk/generic titles.
       - Hero image URL from the page (for later use).
     - **AI extraction:** `extractFromUrl(apiKey, url)` (in `src/app/api/seed/extract/route.ts`) — **Gemini with Google Search grounding** visits the URL and returns a single JSON object: vendor, plant_type, variety, tags, sowing_depth, spacing, sun_requirement, days_to_germination, days_to_maturity, source_url, stock_photo_url / hero_image_url.
   - **Post-processing in extract-metadata:** Decode HTML entities; vendor overrides (e.g. Rare Seeds); blocked tags; generic “flower” → infer specific type from variety; host-specific rules (Renee’s Garden, Outside Pride, San Diego, etc.); strip plant from variety; `cleanVarietyForDisplay`; hero from page if AI didn’t return one.
   - **Response:** Same shape as `ExtractResponse` (type, variety, vendor, tags, hero_image_url, stock_photo_url, sun, plant_spacing, harvest_days, etc.). If product page returns 404 → API returns 404 with `LINK_NOT_FOUND`. If scrape/AI fails or returns “generic” variety → `failed: true` so Pass 2 runs.

3. **Pass 2 — Rescue (only for items with `failed: true`)**  
   For each such item the app calls **`POST /api/seed/extract-rescue`** with `{ url, ... }`.
   - **`rescueFromUrl(apiKey, url)`** (in extract route): Uses **Gemini + Google Search** with variety/vendor hints from URL slug and domain to fill in plant_type, variety, scientific_name, vendor, days_to_maturity, sowing_depth, spacing, sun_requirement, days_to_germination, tags. No page fetch.

4. **Pass 3 — Hero photo (for items that need an image)**  
   For items that don’t already have `hero_image_url` / `stock_photo_url` (or are Rare Seeds), the app calls **`POST /api/seed/find-hero-photo`** with `{ name, variety, vendor, scientific_name?, identity_key, pass: 3 }`.
   - **find-hero-photo:** Tries Tier 1 cache (`plant_extract_cache`), Tier 2 (stored hero path), then **Gemini + Google Search** to find a stock image of the plant/fruit (not the packet). Each attempt is logged to `seed_import_logs` (Settings → Import logs).
   - **Pass 4 / 5:** If Pass 3 fails, the import page retries with simplified queries (e.g. less vendor-specific).

5. **Build review payload**  
   From Pass 1–3 results, the app builds a list of **`ReviewImportItem`** (one per URL): type, variety, vendor, tags, purchaseDate, sowing_depth, spacing, sun_requirement, days_to_germination, days_to_maturity, source_url, hero_image_url, stock_photo_url, identityKey, etc. **Link-import items have no `imageBase64`** (used later to detect link vs photo import).

6. **Navigate to review**  
   Either when all items are done or when user clicks **“Stop & Review”**, the app calls `setReviewImportData({ items })` and navigates to **`/vault/review-import`**.

7. **Review page → create profile and packets**  
   User can edit rows, merge duplicates, then click **“Save All”**. For each item:
   - **Match or create profile:**  
     - Compute canonical key from `name` + `variety`.  
     - If an existing `plant_profiles` row matches (same user_id, same canonical name + variety) → use that `profileId`. Optionally update name/variety from “golden” vendor and set `hero_image_url` if missing.  
     - Else **insert** into `plant_profiles`: `user_id`, `name`, `variety_name`, `primary_image_path: null`, `hero_image_url` (from item’s stock_photo_url/hero_image_url or fallback), `tags`, sun, plant_spacing, days_to_germination, harvest_days, sowing_method, planting_window, botanical_care_notes (e.g. sowing_depth, source_url). Zone 10b defaults applied via `applyZone10bToProfile`.
   - **Packet:** Insert into `seed_packets`: `plant_profile_id`, `user_id`, `vendor_name`, `qty_status: 100`, `purchase_date`, `purchase_url` (source_url), `tags`. Link import has no packet image → `primary_image_path` not set from this step.
   - **Hero download (optional):** If item has a hero URL and `useStockPhotoAsHero` is not false, the app downloads the image (5s timeout), uploads to Supabase Storage (`journal-photos`), updates the profile’s `hero_image_path` and clears `hero_image_url`.
   - **Cache:** Upsert `plant_extract_cache` with full extract payload and hero path/URL for future imports of the same URL.

**Summary (link):**  
URLs → **extract-metadata** (cache or fetch + Gemini URL extraction) → **extract-rescue** if failed → **find-hero-photo** if needed → **review-import** → **Save All** → match or insert **plant_profiles**, insert **seed_packets**, optionally download hero and fill **plant_extract_cache**.

---

## 2. Import by image (photo / camera)

**Entry:** The photo-import flow runs when the app has put items in **pending photo import** and navigates to `/vault/import/photos`. In the codebase this is done by **`BatchAddSeed.processFilesWithGeminiAndRedirect(files)`**: it compresses and base64-encodes the selected files, calls `setPendingPhotoImport({ items })`, then `router.push("/vault/import/photos")`. So in the UI, the user typically adds one or more photos (camera or “Upload from Files”) and then triggers the action that calls that function (e.g. a “Scan with AI” or “Import as new seeds” style button, if wired).

### Step-by-step

1. **Queue photos**  
   In `BatchAddSeed`, user captures or selects images. Each is resized/compressed via `compressImage` (Law 4). Queue is stored as `PendingPhoto[]` (file, previewUrl, etc.).

2. **Send to photo import**  
   When user chooses the “import as new seeds” path (not “Save” in-place), the app builds **`PendingPhotoImportItem[]`**: `id`, `fileName`, `imageBase64` (base64 string, no `data:` prefix). It calls **`setPendingPhotoImport({ items })`** (localStorage) and navigates to **`/vault/import/photos`**.

3. **Photos page — process each image**  
   `ImportPhotosPage` reads `getPendingPhotoImport()`, clears it, and for each item (one at a time):
   - **Phase “Scanning image (AI Pass 1)”:**  
     **`POST /api/seed/extract`** with body `{ imageBase64, mimeType: "image/jpeg" }` (no `url`).
   - **Extract route (image path):**  
     - No URL branch; uses **Gemini 2.5 Flash** with the image only (no search).  
     - **SYSTEM_PROMPT:** “Look at the seed packet image and extract text…” → returns one JSON object: **vendor, plant_type, variety, tags, confidence_score**.  
     - **Normalization:** The image branch applies **`stripPlantFromVariety`** and **`cleanVarietyForDisplay`** (same as link import) so type/variety/tags match the standardized format before returning.  
     - Then, if `type || variety` is present, **`researchVariety(apiKey, type, variety, vendor)`** is called: **Gemini with Google Search grounding** to find sowing_depth, spacing, sun_requirement, days_to_germination, days_to_maturity, source_url, **stock_photo_url** (actual plant/fruit image, not packet).  
     - Result is a full **ExtractResponse** (vendor, type, variety, tags, sowing_depth, spacing, sun_requirement, days_to_germination, days_to_maturity, source_url, stock_photo_url).
   - If **stock_photo_url** is already present from research → mark item **success**, store `extractResult` and `heroPhotoUrl`.
   - Else **cache-by-identity:** The app calls **`POST /api/seed/lookup-by-identity`** with `{ name: data.type, variety: data.variety, vendor: data.vendor }`. If the response has `found: true` and a usable hero URL, the item is marked **success** with that payload and **find-hero-photo is skipped**.
   - Else **Phase “Finding hero photo (Pass 2)”:**  
     **`POST /api/seed/find-hero-photo`** with `{ name: data.type, variety: data.variety, vendor: data.vendor, identity_key }`. Same API as link Pass 3: cache (including `global_plant_cache` by identity_key) then Gemini search for a stock plant image.  
     Then mark item **success** and merge hero URL into `extractResult` (stock_photo_url / hero_image_url).

4. **Build review payload**  
   Successful items are turned into **`ReviewImportItem[]`**: type, variety, vendor, tags, purchaseDate, sowing_depth, spacing, sun_requirement, days_to_germination, days_to_maturity, source_url, stock_photo_url, hero_image_url, **identityKey** (from the same canonical formula as link import), **imageBase64** and **fileName** (so review knows it’s photo import).  
   **`setReviewImportData({ items })`** is called and user is sent to **`/vault/review-import`**.

5. **Review page → create profile and packets**  
   Same **“Save All”** handler as link import, with one difference:
   - **Photo items have `imageBase64`.** So for each item, the app uploads the packet image to Supabase Storage (`seed-packets/{user_id}/{uuid}.jpg`) and sets **`primary_image_path`** on the **first** packet inserted for that profile.  
   - Profile creation and hero handling are the same: match or insert **plant_profiles** (with hero_image_url from stock_photo_url/hero_image_url), insert **seed_packets** (with optional primary_image_path for photo import), optional hero download to storage, and upsert **plant_extract_cache**. For photo import, **source_url** may be from research; if empty, the app uses a **synthetic** value (e.g. `photo:${identityKey}`) so the same user gets cache hits on re-import.

**Summary (image):**  
Photos → **compress** → **setPendingPhotoImport** → **/vault/import/photos** → **POST /api/seed/extract** (image + Gemini packet text, normalization, then `researchVariety` for specs + stock photo) → **lookup-by-identity** (if no stock_photo_url; on hit skip find-hero) → **find-hero-photo** if still no hero → **review-import** → **Save All** → match or insert **plant_profiles**, insert **seed_packets** (with packet image for photo import), optional hero download, **plant_extract_cache** (with synthetic source_url when no URL).

---

## 3. Side-by-side

| Step | Import by link | Import by image |
|------|----------------|-----------------|
| Input | One or more URLs | One or more photos (camera/file) |
| Entry UI | `/vault/import` → Start Import | BatchAddSeed → “Import as new seeds” → `/vault/import/photos` |
| Identity / metadata | **extract-metadata**: cache or fetch page + **extractFromUrl** (Gemini visits URL) | **extract**: Gemini reads **packet image** → then **researchVariety** (Gemini search for specs + stock photo) |
| Rescue | **extract-rescue** (Gemini search from URL slug) if Pass 1 failed | N/A |
| Hero image | **find-hero-photo** (cache + Gemini search) for items missing hero or Rare Seeds | **lookup-by-identity** (on hit use cache, skip find-hero); else **find-hero-photo** if research didn’t return stock_photo_url |
| Review | `/vault/review-import` (items have no imageBase64) | Same (items have imageBase64 + fileName) |
| Save All | Match/create **plant_profiles**, insert **seed_packets** (no packet image), optional hero download, **plant_extract_cache** | Same, plus **upload packet image** to `seed-packets` and set **primary_image_path** on packet |

So: **link** uses the **URL + product page + AI visiting the URL** to get identity and hero; **image** uses **AI reading the packet image** plus **research/search** for specs and hero. Both end on the same review screen and the same **Save All** logic; the only difference at save is that photo import uploads the packet image and sets `primary_image_path` on the packet.
