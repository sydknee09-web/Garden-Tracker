/**
 * clean-bad-cache.ts — Find bad rows in global_plant_cache, then (with --confirm)
 * delete them and remove those URLs from scrape progress so bulk-scrape will re-scrape them.
 *
 * Prerequisites:
 *   1. Migration applied: 20250214000000_global_plant_cache_bad_rows_rpc.sql
 *   2. .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   npm run clean-bad-cache              (dry run: list bad rows, write file, no changes)
 *   npm run clean-bad-cache -- --confirm  (delete from Supabase + update progress file)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectRoot = path.join(__dirname, "..");
const envPath = path.join(projectRoot, ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR_PROJECT_REF")) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL missing or placeholder. Set it in .env.local");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY not set. Set it in .env.local");
  process.exit(1);
}

const DATA_DIR = path.join(projectRoot, "data");
const BAD_ROWS_FILE = path.join(DATA_DIR, "bad-cache-rows-to-delete.json");
const PROGRESS_FILE = path.join(DATA_DIR, "scrape-progress.json");

interface BadRow {
  id: string;
  source_url: string;
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

async function fetchBadRowIds(): Promise<BadRow[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_global_plant_cache_bad_row_ids`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RPC failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data as BadRow[];
}

async function deleteRowsById(ids: string[]): Promise<void> {
  const BATCH = 80;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const filterValue = `in.(${batch.join(",")})`;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/global_plant_cache?id=${encodeURIComponent(filterValue)}`,
      {
        method: "DELETE",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Delete batch failed: ${res.status} ${text}`);
    }
  }
}

interface ProgressData {
  completed: Record<string, string[]>;
  failed: Record<string, string[]>;
  nextIndex?: Record<string, number>;
  stats: {
    total_scraped: number;
    total_failed: number;
    total_cached: number;
    started_at: string;
    last_updated: string;
  };
}

function loadProgress(): ProgressData {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }
  return {
    completed: {},
    failed: {},
    stats: {
      total_scraped: 0,
      total_failed: 0,
      total_cached: 0,
      started_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    },
  };
}

function saveProgress(progress: ProgressData): void {
  progress.stats.last_updated = new Date().toISOString();
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf-8");
}

function removeUrlsFromProgress(progress: ProgressData, urls: string[]): number {
  const urlSet = new Set(urls);
  let removed = 0;
  for (const domain of Object.keys(progress.completed)) {
    const arr = progress.completed[domain]!;
    const before = arr.length;
    progress.completed[domain] = arr.filter((u) => !urlSet.has(u));
    removed += before - progress.completed[domain]!.length;
  }
  return removed;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");

  console.log("\n🧹 Clean bad cache rows (product codes, pepper hot/sweet, general+empty)\n");

  let rows: BadRow[];
  try {
    rows = await fetchBadRowIds();
  } catch (e) {
    console.error("Could not fetch bad rows. Is the migration applied?", e);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log("No bad rows found. Nothing to do.");
    return;
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BAD_ROWS_FILE, JSON.stringify(rows, null, 2), "utf-8");

  console.log("Found " + rows.length + " bad row(s).");
  console.log("Saved list to: " + BAD_ROWS_FILE);
  const sample = rows.slice(0, 5);
  console.log("Sample URLs:");
  sample.forEach((r) => console.log("  " + r.source_url));
  if (rows.length > 5) console.log("  ... and " + (rows.length - 5) + " more.\n");

  if (!confirm) {
    console.log("This was a DRY RUN. No changes made.");
    console.log("To delete these rows and update progress so bulk-scrape will re-scrape them, run:");
    console.log("  npm run clean-bad-cache -- --confirm\n");
    return;
  }

  console.log("Deleting from Supabase...");
  await deleteRowsById(rows.map((r) => r.id));
  console.log("Deleted " + rows.length + " row(s).");

  const progress = loadProgress();
  const urls = rows.map((r) => r.source_url);
  const removedFromProgress = removeUrlsFromProgress(progress, urls);
  saveProgress(progress);
  console.log("Removed " + removedFromProgress + " URL(s) from scrape progress (so they will be re-scraped).");
  console.log("\nDone. Run npm run bulk-scrape to re-scrape those URLs (with dev server running).\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
