# Data maintenance

Runbook for keeping the global plant cache and vendor URL list up to date. Use at season start or when adding vendors.

1. **Discover URLs**  
   `npm run discover-urls` — refreshes the vendor URL list (output used by bulk-scrape).

2. **Bulk-scrape**  
   `npm run bulk-scrape` — scrapes URLs and writes to `global_plant_cache` with normalized type/variety and identity_key.  
   Optional: `--vendor <domain>`, `--no-ai`, `--round-robin` (see script help).

3. **Scrape-cleanup**  
   `npm run scrape-cleanup` — handles partial or failed rows (retry or mark).

4. **Normalize (when needed)**  
   After changing identity or normalization rules, run `npm run normalize-global-cache` once to backfill existing `global_plant_cache` rows.

5. **Single URL fix**  
   Settings → Developer → **Re-extract this URL** — overwrites one cache row without running scripts. Use when a single entry is wrong or stale.
