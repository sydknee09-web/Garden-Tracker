/**
 * scrape-cleanup.ts — Targeted AI pass for partial-quality rows in global_plant_cache.
 *
 * After running bulk-scrape.ts with --no-ai, many rows will have scrape_quality = 'partial'
 * (missing key fields). This script re-scrapes those URLs WITH AI enabled, spending
 * Gemini API credits only on the difficult cases.
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev
 *   2. Environment vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:  npx ts-node scripts/scrape-cleanup.ts
 *       npx ts-node scripts/scrape-cleanup.ts --vendor rareseeds.com
 *       npx ts-node scripts/scrape-cleanup.ts --quality failed
 *       npx ts-node scripts/scrape-cleanup.ts --limit 100
 */

import * as fs from "fs";
import * as path from "path";
import { identityKeyFromVariety } from "../src/lib/identityKey";
import { stripPlantFromVariety, cleanVarietyForDisplay } from "../src/lib/varietyNormalize";

// ── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = process.env.SCRAPE_TEST_BASE_URL ?? "http://localhost:3000";
const API_PATH = "/api/seed/scrape-url";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Jittered delay: 2-4s between requests */
const DELAY_BASE_MS = 2000;
const DELAY_JITTER_MS = 2000;

function jitteredDelay(): Promise<void> {
  const ms = DELAY_BASE_MS + Math.random() * DELAY_JITTER_MS;
  return new Promise((r) => setTimeout(r, ms));
}

// ── Supabase helpers ─────────────────────────────────────────────────────────
interface CacheRow {
  id: string;
  source_url: string;
  vendor: string | null;
  scrape_quality: string | null;
}

async function fetchPartialRows(
  targetQuality: string,
  targetVendor: string | undefined,
  limit: number
): Promise<CacheRow[]> {
  let queryUrl = `${SUPABASE_URL}/rest/v1/global_plant_cache?select=id,source_url,vendor,scrape_quality&scrape_quality=eq.${targetQuality}&order=created_at.asc&limit=${limit}`;
  if (targetVendor) {
    queryUrl += `&vendor=eq.${encodeURIComponent(targetVendor)}`;
  }

  const res = await fetch(queryUrl, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    console.error(`Failed to fetch rows: HTTP ${res.status}`);
    return [];
  }

  return (await res.json()) as CacheRow[];
}

async function updateCacheRow(
  id: string,
  updates: {
    extract_data: Record<string, unknown>;
    original_hero_url: string | null;
    scraped_fields: string[];
    scrape_quality: string;
    identity_key: string;
  }
): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/global_plant_cache?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        ...updates,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  return res.ok;
}

// ── Scrape + update logic ────────────────────────────────────────────────────
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

/** Build identity_key using shared formula (must match bulk-scrape for cache consistency). */
function buildIdentityKeyAndNormalize(data: Record<string, unknown>): {
  identityKey: string;
  typeNorm: string;
  varietyNorm: string;
  tagsMerged: string[];
} {
  let typeNorm = String(data.plant_name ?? data.ogTitle ?? "").trim() || "";
  let varietyNorm = String(data.variety_name ?? "").trim();
  varietyNorm = stripPlantFromVariety(varietyNorm, typeNorm);
  const { cleanedVariety, tagsToAdd } = cleanVarietyForDisplay(varietyNorm, typeNorm);
  varietyNorm = cleanedVariety;
  const identityKey = identityKeyFromVariety(typeNorm || "Imported seed", varietyNorm) || "unknown";
  const tagsRaw = Array.isArray(data.tags) ? (data.tags as string[]).filter((t) => typeof t === "string").map((t) => String(t).trim()).filter(Boolean) : [];
  const tagsMerged = [...tagsRaw];
  for (const t of tagsToAdd) {
    if (t && !tagsMerged.some((x) => x.toLowerCase() === t.toLowerCase())) tagsMerged.push(t);
  }
  return { identityKey, typeNorm: typeNorm || "Imported seed", varietyNorm, tagsMerged };
}

async function cleanupOne(row: CacheRow): Promise<{ improved: boolean; newQuality: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}${API_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: row.source_url }),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok || data.error) {
      return { improved: false, newQuality: "failed", error: (data.error as string) ?? `HTTP ${res.status}` };
    }

    const newQuality = determineScrapeQuality(data);
    const scrapedFields = collectScrapedFields(data);
    const { identityKey, typeNorm, varietyNorm, tagsMerged } = buildIdentityKeyAndNormalize(data);

    const heroUrl =
      (data.imageUrl as string) ??
      (data.hero_image_url as string) ??
      (data.stock_photo_url as string) ??
      null;

    const extractData: Record<string, unknown> = {
      type: typeNorm,
      variety: varietyNorm,
      vendor: row.vendor ?? "",
      tags: tagsMerged,
      source_url: row.source_url,
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

    // Only update if quality improved (or at least stayed the same with more fields)
    const qualityRank: Record<string, number> = { failed: 0, partial: 1, ai_only: 2, full: 3 };
    const oldRank = qualityRank[row.scrape_quality ?? "partial"] ?? 1;
    const newRank = qualityRank[newQuality] ?? 1;
    const improved = newRank > oldRank;

    if (improved || newRank >= oldRank) {
      await updateCacheRow(row.id, {
        extract_data: extractData,
        original_hero_url: heroUrl,
        scraped_fields: scrapedFields,
        scrape_quality: newQuality,
        identity_key: identityKey,
      });
    }

    return { improved, newQuality };
  } catch (err) {
    return { improved: false, newQuality: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  // Parse CLI args
  const args = process.argv.slice(2);
  const vendorFlag = args.indexOf("--vendor");
  const targetVendor = vendorFlag >= 0 ? args[vendorFlag + 1] : undefined;
  const qualityFlag = args.indexOf("--quality");
  const targetQuality = qualityFlag >= 0 ? (args[qualityFlag + 1] ?? "partial") : "partial";
  const limitFlag = args.indexOf("--limit");
  const limit = limitFlag >= 0 ? parseInt(args[limitFlag + 1] ?? "500", 10) : 500;

  console.log(`\n🧹 Scrape Cleanup (AI Pass)`);
  console.log(`   Target quality: ${targetQuality}`);
  console.log(`   Vendor filter: ${targetVendor ?? "all"}`);
  console.log(`   Limit: ${limit}`);
  console.log(`   Scraper: ${BASE_URL}${API_PATH} (AI enabled)`);
  console.log();

  // Fetch rows needing cleanup
  const rows = await fetchPartialRows(targetQuality, targetVendor, limit);
  if (rows.length === 0) {
    console.log(`No rows with scrape_quality = '${targetQuality}' found. Nothing to clean up.`);
    return;
  }

  console.log(`Found ${rows.length} rows to re-scrape with AI.\n`);

  let improved = 0;
  let unchanged = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (i > 0) await jitteredDelay();

    const result = await cleanupOne(row);

    if (result.error) {
      errors++;
    } else if (result.improved) {
      improved++;
    } else {
      unchanged++;
    }

    // Progress every 10
    if ((i + 1) % 10 === 0 || i === rows.length - 1) {
      const pct = Math.round(((i + 1) / rows.length) * 100);
      console.log(
        `  [${i + 1}/${rows.length}] (${pct}%) | improved: ${improved} | unchanged: ${unchanged} | errors: ${errors} | last: ${result.newQuality}`
      );
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("CLEANUP SUMMARY");
  console.log("=".repeat(50));
  console.log(`  Total processed: ${rows.length}`);
  console.log(`  Improved:        ${improved}`);
  console.log(`  Unchanged:       ${unchanged}`);
  console.log(`  Errors:          ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
