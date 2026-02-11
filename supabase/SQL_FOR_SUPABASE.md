# SQL to run in Supabase

When the app has schema changes, run the matching SQL below in the **Supabase Dashboard → SQL Editor** (or via `supabase db push` if you use the CLI). Run blocks in order if you're applying multiple updates.

---

## 1. Growing notes (plant profile)

**From migration:** `20250205000000_plant_varieties_growing_notes.sql`

```sql
-- Add growing notes / requirements to plant profile
ALTER TABLE plant_varieties ADD COLUMN IF NOT EXISTS growing_notes text;
```

---

## 2. Days to germination & spacing (Growing requirements table)

**From migration:** `20250205100000_plant_varieties_germination_spacing.sql`

```sql
-- Structured fields for scraped growing info (shown in Growing requirements table)
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS days_to_germination text,
  ADD COLUMN IF NOT EXISTS plant_spacing text;
```

---

## 3. Growing info from source (scraped text in grey box)

**From migration:** `20250205200000_plant_varieties_growing_info_from_source.sql`

Scraped narrative from "Add from link" is stored here and shown in the grey Growing requirements box. User notes stay in `growing_notes` only.

```sql
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS growing_info_from_source text;
```

---

## 4. Plant description (scraped variety summary)

**From migration:** `20250205300000_plant_varieties_plant_description.sql`

Marketing/variety summary from the top of the product page (and Specs like Plant Height, Packet) is stored here and shown in the "Plant description" section.

```sql
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS plant_description text;
```

---

## 5. Pre-treatment notes (native seeds)

**From migration:** `20250205400000_plant_varieties_pretreatment_notes.sql`

Pre-treatment instructions (smoke, stratification, boiling water, etc.) from native-seed vendors (e.g. Theodore Payne, Native West) are stored here and shown in the Growing requirements section.

```sql
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS pretreatment_notes text;
```

---

## 6. Scraper audit (Load Seed Details status)

**From migration:** `20250205500000_plant_varieties_scrape_audit.sql`

Temporary audit: `scrape_status` (Success / Partial / Failed) and `scrape_error_log` for "Load Seed Details" runs.

```sql
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS scrape_status text,
  ADD COLUMN IF NOT EXISTS scrape_error_log text;
```

---

## One-shot: apply all app schema updates

If you haven’t run either of the above yet, you can run this once:

```sql
-- Growing notes (user-editable only)
ALTER TABLE plant_varieties ADD COLUMN IF NOT EXISTS growing_notes text;

-- Days to germination & spacing (for scraped seed details)
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS days_to_germination text,
  ADD COLUMN IF NOT EXISTS plant_spacing text;

-- Scraped narrative (shown in grey requirements box; not in Growing notes)
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS growing_info_from_source text;

-- Scraped variety summary (Plant description section)
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS plant_description text;

-- Pre-treatment notes (native seeds: smoke, stratification, etc.)
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS pretreatment_notes text;

-- Scraper audit (Success / Partial / Failed + error log)
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS scrape_status text,
  ADD COLUMN IF NOT EXISTS scrape_error_log text;
```

---

*Cascade delete:* `seed_stocks.plant_variety_id` already uses `REFERENCES plant_varieties(id) ON DELETE CASCADE` in your migrations, so no extra SQL is needed for that.
