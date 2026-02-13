# Data maintenance

Runbook for keeping the global plant cache and vendor URL list up to date. Use at season start or when adding vendors. **You don’t need to write code** — just run the commands below in order when you do a seasonal refresh or after a vendor parsing fix.

---

## How you’ll run this (step by step)

1. **Discover URLs**  
   In the project folder, open a terminal and run:  
   `npm run discover-urls`  
   This refreshes the list of vendor product URLs that bulk-scrape will use.

2. **Bulk-scrape**  
   Run:  
   `npm run bulk-scrape`  
   This visits each URL, scrapes product info, and writes it into the **global plant cache** (with plant type and variety normalized per vendor).  
   Optional flags: `--vendor johnnyseeds.com` (only that vendor), `--ai` (use Tavily when needed), `--parallel` (faster). Run `npm run bulk-scrape -- --help` to see all options.

3. **Clean bad cache rows (only when we’ve fixed a vendor rule)**  
   After a code change that fixes how we parse a vendor (e.g. Johnny’s plant/variety from URL), old cache rows may still have wrong data. This step finds and deletes those so the next bulk-scrape can re-scrape them.  
   - Make sure the migration `20250214000000_global_plant_cache_bad_rows_rpc.sql` has been applied to your Supabase project.  
   - **Dry run:**  
     `npm run clean-bad-cache`  
     This lists “bad” rows and saves them to `data/bad-cache-rows-to-delete.json`. Check that list if you want.  
   - **Actually delete:**  
     `npm run clean-bad-cache -- --confirm`  
     This deletes those rows from Supabase and clears them from scrape progress so the next bulk-scrape will hit those URLs again.  
   - If the dry run still finds more bad rows (e.g. you had over 1000), run dry run + `--confirm` again until the dry run finds none.

4. **Scrape-cleanup (optional)**  
   `npm run scrape-cleanup` — for partial or failed scrapes (retry or mark).

5. **Normalize (only when we change identity/normalization rules)**  
   After a developer changes how we build identity keys or normalize names, run once:  
   `npm run normalize-global-cache`  
   to backfill existing cache rows.

6. **Single URL fix**  
   In the app: **Settings → Developer → Re-extract this URL**. Use this when one specific link is wrong or stale; it overwrites that one cache row without running any scripts.

---

## Do we treat vendor links differently?

**Yes.** Each supported vendor has its own parsing rule in the code. For example:

- **Johnny’s:** The URL is like `.../vegetables/beans/bush-beans/provider-bean-seed-10.html`. We use the **last two parts**: the path segment before the slug = **plant** (e.g. `bush-beans` → “Bush Bean”), and the slug = **variety** (e.g. “Provider”).
- **Burpee, Eden Brothers, Swallowtail, Fedco, etc.** each have their own logic in the same places (scrape-url API and bulk-scrape script).

So your vendor-specific instructions *are* used — they’re implemented as separate branches per vendor. When something is still wrong (e.g. “Bean” instead of “Bush Bean”), it’s usually because that vendor’s rule was implemented with the wrong segment or pattern, not because we’re ignoring vendors. For Johnny’s, the bug was using the *first* non-category path segment (“beans”) instead of the *last* path segment (“bush-beans”); that’s now fixed so plant = last path segment, variety = from slug.

---

## When to run what

- **Start of season / refresh catalog:** Run steps 1 → 2. Optionally 4 if you have failures.
- **After a vendor parsing fix in code:** Run step 3 (dry run, then `--confirm` if needed, maybe multiple times until no bad rows), then step 2 for that vendor (e.g. `npm run bulk-scrape -- --vendor johnnyseeds.com`).
- **One wrong link:** Use step 6 (Re-extract this URL) in the app.
