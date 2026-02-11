/**
 * bulk-scrape.ts — Feed discovered vendor URLs through the existing scraper
 * and store results in global_plant_cache via Supabase service-role client.
 *
 * Prerequisites:
 *   1. Run `npx ts-node scripts/discover-urls.ts` first to generate data/vendor-urls.json
 *   2. Dev server running: npm run dev
 *   3. Environment vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:  npx ts-node scripts/bulk-scrape.ts
 *       npx ts-node scripts/bulk-scrape.ts --no-ai
 *       npx ts-node scripts/bulk-scrape.ts --vendor rareseeds.com
 *       npx ts-node scripts/bulk-scrape.ts --vendor rareseeds.com --no-ai
 */

import * as fs from "fs";
import * as path from "path";

// ── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = process.env.SCRAPE_TEST_BASE_URL ?? "http://localhost:3000";
const API_PATH = "/api/seed/scrape-url";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Max vendor streams running in parallel */
const MAX_PARALLEL_VENDORS = 4;

/** Jittered delay between requests to same vendor: 2-4s */
const DELAY_BASE_MS = 2000;
const DELAY_JITTER_MS = 2000;

/** Retry failed URLs once after this cooldown */
const RETRY_COOLDOWN_MS = 30_000;

// ── Supabase service-role client (bypasses RLS) ──────────────────────────────
async function upsertGlobalCache(row: {
  source_url: string;
  identity_key: string;
  vendor: string;
  extract_data: Record<string, unknown>;
  original_hero_url: string | null;
  scraped_fields: string[];
  scrape_quality: string;
}): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/global_plant_cache`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      ...row,
      updated_at: new Date().toISOString(),
    }),
  });
  return res.ok;
}

async function isAlreadyCached(sourceUrl: string): Promise<boolean> {
  const encoded = encodeURIComponent(sourceUrl);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/global_plant_cache?source_url=eq.${encoded}&select=id&limit=1`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function jitteredDelay(): Promise<void> {
  const ms = DELAY_BASE_MS + Math.random() * DELAY_JITTER_MS;
  return new Promise((r) => setTimeout(r, ms));
}

function getVendor(urlString: string): string {
  try {
    return new URL(urlString).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/** Build identity_key from scraper response (same as vault code: `type_variety`) */
function buildIdentityKey(data: Record<string, unknown>): string {
  const t = ((data.plant_name as string) ?? (data.ogTitle as string) ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const v = ((data.variety_name as string) ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return t && v ? `${t}_${v}` : t || v || "unknown";
}

/** Fields we track for quality reporting */
const TRACKED_FIELDS = [
  "sun", "water", "plant_spacing", "days_to_germination", "harvest_days",
  "plant_description", "growing_notes", "imageUrl", "latin_name",
  "life_cycle", "hybrid_status",
] as const;

function collectScrapedFields(data: Record<string, unknown>): string[] {
  const found: string[] = [];
  for (const key of TRACKED_FIELDS) {
    const v = data[key];
    if (v == null) continue;
    if (typeof v === "string" && v.trim()) found.push(key);
    if (typeof v === "number" && !Number.isNaN(v)) found.push(key);
  }
  return found;
}

function determineScrapeQuality(data: Record<string, unknown>): string {
  const status = (data.scrape_status as string) ?? "";
  if (status === "AI_SEARCH") return "ai_only";
  if (status === "Failed") return "failed";
  if (status === "Success") return "full";
  return "partial";
}

// ── Progress tracking ────────────────────────────────────────────────────────
interface ProgressData {
  completed: Record<string, string[]>;  // vendor -> completed URLs
  failed: Record<string, string[]>;     // vendor -> failed URLs
  stats: {
    total_scraped: number;
    total_failed: number;
    total_cached: number;
    started_at: string;
    last_updated: string;
  };
}

function loadProgress(filePath: string): ProgressData {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch { /* fresh start */ }
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

function saveProgress(filePath: string, progress: ProgressData): void {
  progress.stats.last_updated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2), "utf-8");
}

// ── Scrape one URL ───────────────────────────────────────────────────────────
interface ScrapeResult {
  url: string;
  success: boolean;
  quality: string;
  fieldsFound: number;
  error?: string;
}

async function scrapeOne(url: string, noAi: boolean): Promise<ScrapeResult> {
  try {
    const body: Record<string, unknown> = { url };
    if (noAi) {
      // The scraper checks for this flag to skip AI fallback
      body.skipAiFallback = true;
    }

    const res = await fetch(`${BASE_URL}${API_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok || data.error) {
      return {
        url,
        success: false,
        quality: "failed",
        fieldsFound: 0,
        error: (data.error as string) ?? `HTTP ${res.status}`,
      };
    }

    const vendor = getVendor(url);
    const identityKey = buildIdentityKey(data);
    const scrapedFields = collectScrapedFields(data);
    const quality = determineScrapeQuality(data);

    // Extract hero image URL
    const heroUrl =
      (data.imageUrl as string) ??
      (data.hero_image_url as string) ??
      (data.stock_photo_url as string) ??
      null;

    // Build extract_data (the full payload to cache)
    const extractData: Record<string, unknown> = {
      type: data.plant_name ?? data.ogTitle ?? "",
      variety: data.variety_name ?? "",
      vendor: vendor,
      tags: data.tags ?? [],
      source_url: url,
      sowing_depth: data.sowing_depth ?? undefined,
      spacing: data.plant_spacing ?? undefined,
      sun_requirement: data.sun ?? undefined,
      days_to_germination: data.days_to_germination ?? undefined,
      days_to_maturity: data.harvest_days ?? undefined,
      scientific_name: data.latin_name ?? undefined,
      hero_image_url: heroUrl ?? undefined,
      plant_description: data.plant_description ?? undefined,
      growing_notes: data.growing_notes ?? undefined,
      life_cycle: data.life_cycle ?? undefined,
      hybrid_status: data.hybrid_status ?? undefined,
    };

    // Upsert into global_plant_cache
    const cached = await upsertGlobalCache({
      source_url: url,
      identity_key: identityKey,
      vendor: vendor,
      extract_data: extractData,
      original_hero_url: heroUrl,
      scraped_fields: scrapedFields,
      scrape_quality: quality,
    });

    if (!cached) {
      return {
        url,
        success: false,
        quality,
        fieldsFound: scrapedFields.length,
        error: "Failed to upsert into global_plant_cache",
      };
    }

    return { url, success: true, quality, fieldsFound: scrapedFields.length };
  } catch (err) {
    return {
      url,
      success: false,
      quality: "failed",
      fieldsFound: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Process one vendor's URLs ────────────────────────────────────────────────
async function processVendor(
  domain: string,
  urls: string[],
  progress: ProgressData,
  progressFile: string,
  noAi: boolean
): Promise<{ scraped: number; failed: number; skipped: number }> {
  const completed = new Set(progress.completed[domain] ?? []);
  const pendingUrls = urls.filter((u) => !completed.has(u));

  if (pendingUrls.length === 0) {
    console.log(`  [${domain}] All ${urls.length} URLs already processed, skipping.`);
    return { scraped: 0, failed: 0, skipped: urls.length };
  }

  console.log(`  [${domain}] ${pendingUrls.length} pending (${completed.size} already done)`);

  let scraped = 0;
  let failed = 0;
  const skipped = urls.length - pendingUrls.length;
  const failedUrls: string[] = [];

  for (let i = 0; i < pendingUrls.length; i++) {
    const url = pendingUrls[i]!;

    // Check if already in global cache (resumability)
    const alreadyCached = await isAlreadyCached(url);
    if (alreadyCached) {
      if (!progress.completed[domain]) progress.completed[domain] = [];
      progress.completed[domain]!.push(url);
      progress.stats.total_cached++;
      continue;
    }

    // Jittered delay between requests
    if (i > 0) await jitteredDelay();

    const result = await scrapeOne(url, noAi);

    if (result.success) {
      scraped++;
      progress.stats.total_scraped++;
      if (!progress.completed[domain]) progress.completed[domain] = [];
      progress.completed[domain]!.push(url);
    } else {
      failed++;
      progress.stats.total_failed++;
      failedUrls.push(url);
    }

    // Progress logging every 10 URLs
    if ((i + 1) % 10 === 0 || i === pendingUrls.length - 1) {
      const pct = Math.round(((i + 1) / pendingUrls.length) * 100);
      const qualLabel = result.success ? result.quality : "FAIL";
      console.log(`    [${domain}] ${i + 1}/${pendingUrls.length} (${pct}%) | last: ${qualLabel} | fields: ${result.fieldsFound}`);
      saveProgress(progressFile, progress);
    }
  }

  // Retry failed URLs once
  if (failedUrls.length > 0) {
    console.log(`  [${domain}] Retrying ${failedUrls.length} failed URLs after cooldown...`);
    await new Promise((r) => setTimeout(r, RETRY_COOLDOWN_MS));

    for (const url of failedUrls) {
      await jitteredDelay();
      const retry = await scrapeOne(url, noAi);
      if (retry.success) {
        scraped++;
        failed--;
        progress.stats.total_scraped++;
        progress.stats.total_failed--;
        if (!progress.completed[domain]) progress.completed[domain] = [];
        progress.completed[domain]!.push(url);
      } else {
        if (!progress.failed[domain]) progress.failed[domain] = [];
        progress.failed[domain]!.push(url);
      }
    }
    saveProgress(progressFile, progress);
  }

  return { scraped, failed, skipped };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // Validate env
  if (!SUPABASE_URL) {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL not set.");
    process.exit(1);
  }
  if (!SERVICE_ROLE_KEY) {
    console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY not set.");
    process.exit(1);
  }

  // Parse CLI args
  const args = process.argv.slice(2);
  const noAi = args.includes("--no-ai");
  const vendorFlag = args.indexOf("--vendor");
  const targetVendor = vendorFlag >= 0 ? args[vendorFlag + 1] : undefined;

  // Load discovered URLs
  const dataDir = path.join(__dirname, "..", "data");
  const urlsFile = path.join(dataDir, "vendor-urls.json");
  if (!fs.existsSync(urlsFile)) {
    console.error(`ERROR: ${urlsFile} not found. Run discover-urls.ts first.`);
    process.exit(1);
  }

  const vendorData: Record<string, { discovered: number; urls: string[] }> = JSON.parse(
    fs.readFileSync(urlsFile, "utf-8")
  );

  // Filter vendors if --vendor flag
  const vendorDomains = Object.keys(vendorData).filter((d) => {
    if (targetVendor) return d.includes(targetVendor);
    return true;
  });

  if (vendorDomains.length === 0) {
    console.error(`No vendors matching "${targetVendor}".`);
    process.exit(1);
  }

  const totalUrls = vendorDomains.reduce((sum, d) => sum + (vendorData[d]?.urls?.length ?? 0), 0);

  console.log(`\n🚀 Bulk Scrape Pipeline`);
  console.log(`   Vendors: ${vendorDomains.length}`);
  console.log(`   Total URLs: ${totalUrls}`);
  console.log(`   AI fallback: ${noAi ? "DISABLED (--no-ai)" : "ENABLED"}`);
  console.log(`   Parallel streams: ${MAX_PARALLEL_VENDORS}`);
  console.log(`   Delay: ${DELAY_BASE_MS}-${DELAY_BASE_MS + DELAY_JITTER_MS}ms (jittered)`);
  console.log(`   Scraper: ${BASE_URL}${API_PATH}`);
  console.log(`   Target DB: ${SUPABASE_URL}`);
  console.log();

  // Load / initialize progress
  const progressFile = path.join(dataDir, "scrape-progress.json");
  const progress = loadProgress(progressFile);

  // Process vendors in parallel batches
  const results: Record<string, { scraped: number; failed: number; skipped: number }> = {};

  // Chunk vendors into parallel groups
  for (let i = 0; i < vendorDomains.length; i += MAX_PARALLEL_VENDORS) {
    const batch = vendorDomains.slice(i, i + MAX_PARALLEL_VENDORS);
    console.log(`\n── Batch ${Math.floor(i / MAX_PARALLEL_VENDORS) + 1}: ${batch.join(", ")} ──`);

    const promises = batch.map(async (domain) => {
      const urls = vendorData[domain]?.urls ?? [];
      if (urls.length === 0) {
        results[domain] = { scraped: 0, failed: 0, skipped: 0 };
        return;
      }
      results[domain] = await processVendor(domain, urls, progress, progressFile, noAi);
    });

    await Promise.all(promises);
  }

  // Final save
  saveProgress(progressFile, progress);

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("BULK SCRAPE SUMMARY");
  console.log("=".repeat(70));
  console.log(`${"Vendor".padEnd(35)} ${"Scraped".padStart(8)} ${"Failed".padStart(8)} ${"Skipped".padStart(8)}`);
  console.log("-".repeat(63));

  let totalScraped = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const domain of vendorDomains) {
    const r = results[domain] ?? { scraped: 0, failed: 0, skipped: 0 };
    totalScraped += r.scraped;
    totalFailed += r.failed;
    totalSkipped += r.skipped;
    console.log(
      `${domain.padEnd(35)} ${String(r.scraped).padStart(8)} ${String(r.failed).padStart(8)} ${String(r.skipped).padStart(8)}`
    );
  }

  console.log("-".repeat(63));
  console.log(
    `${"TOTAL".padEnd(35)} ${String(totalScraped).padStart(8)} ${String(totalFailed).padStart(8)} ${String(totalSkipped).padStart(8)}`
  );
  console.log(`\nProgress saved to: ${progressFile}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
