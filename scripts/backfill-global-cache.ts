/**
 * Backfill global_plant_cache: find rows with empty or failed data and fill them using AI.
 * Never overwrites existing data — only fills empty/missing fields. Makes your cache robust
 * so new plants and lookups can rely on it.
 *
 * Targets:
 *   - scrape_quality = 'failed' or 'partial' or null
 *   - Or any row where extract_data is missing key fields (sun, spacing, germination, maturity, description, notes)
 *
 * For each such row: call Gemini (researchVariety), merge result into extract_data (blanks only),
 * update the cache row and set scrape_quality to at least 'partial' or 'ai_only'.
 *
 * Prerequisites: .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_GENERATIVE_AI_API_KEY
 *
 * Run:
 *   npm run backfill-cache              # process all cache rows that need filling (can take a long time)
 *   npm run backfill-cache -- --limit 50
 *   npm run backfill-cache -- --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { researchVariety } from "../src/lib/researchVariety";

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
const GEMINI_KEY = (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "").trim();

if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR_PROJECT_REF")) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL missing. Set in .env.local");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY missing. Set in .env.local");
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error("ERROR: GOOGLE_GENERATIVE_AI_API_KEY missing. Required for backfilling cache.");
  process.exit(1);
}

const BATCH_SIZE = 500;
const AI_DELAY_MS = 2000;

function parseArgs(): { limit: number; dryRun: boolean } {
  const args = process.argv.slice(2);
  let limit = 0; // 0 = no limit, process all
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1] !== undefined) {
      limit = parseInt(args[i + 1], 10) || 0;
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }
  return { limit, dryRun };
}

type CacheRow = {
  id: string;
  source_url: string;
  identity_key: string;
  vendor: string | null;
  extract_data: Record<string, unknown>;
  original_hero_url: string | null;
  scrape_quality: string | null;
  updated_at: string;
};

/** True if this cache row has at least one empty key field we can try to fill. */
function cacheRowNeedsFilling(row: CacheRow): boolean {
  const q = (row.scrape_quality ?? "").toLowerCase();
  if (q === "failed" || q === "partial") return true;
  const ed = row.extract_data ?? {};
  const has = (v: unknown) => v != null && String(v).trim() !== "";
  const hasSun = has(ed.sun_requirement) || has(ed.sun);
  const hasSpacing = has(ed.spacing) || has(ed.plant_spacing);
  const hasGerm = has(ed.days_to_germination);
  const hasMaturity = has(ed.days_to_maturity);
  const hasDesc = has(ed.plant_description);
  const hasNotes = has(ed.growing_notes);
  const hasWater = has(ed.water);
  const hasSowingDepth = has(ed.sowing_depth);
  const hasSowingMethod = has(ed.sowing_method);
  const hasPlantingWindow = has(ed.planting_window);
  if (!hasSun || !hasSpacing || !hasGerm || !hasMaturity || !hasDesc || !hasNotes || !hasWater || !hasSowingDepth || !hasSowingMethod || !hasPlantingWindow) return true;
  return false;
}

/** Merge AI result into extract_data. Only set fields that are currently empty (never overwrite). */
function mergeAiIntoExtractData(
  ed: Record<string, unknown>,
  result: { sun_requirement?: string; spacing?: string; days_to_germination?: string; days_to_maturity?: string; plant_description?: string; growing_notes?: string; sowing_depth?: string; water?: string; sowing_method?: string; planting_window?: string; stock_photo_url?: string }
): Record<string, unknown> {
  const out = { ...ed };
  const setIfEmpty = (key: string, value: string | undefined) => {
    if (!value?.trim()) return;
    const current = out[key];
    if (current != null && String(current).trim() !== "") return;
    out[key] = value.trim();
  };
  setIfEmpty("sun_requirement", result.sun_requirement);
  setIfEmpty("spacing", result.spacing);
  setIfEmpty("days_to_germination", result.days_to_germination);
  setIfEmpty("days_to_maturity", result.days_to_maturity);
  setIfEmpty("plant_description", result.plant_description);
  setIfEmpty("growing_notes", result.growing_notes);
  setIfEmpty("sowing_depth", result.sowing_depth);
  setIfEmpty("water", result.water);
  setIfEmpty("sowing_method", result.sowing_method);
  setIfEmpty("planting_window", result.planting_window);
  if (result.stock_photo_url?.trim().startsWith("http") && !out.hero_image_url && !out.original_hero_url) {
    out.hero_image_url = result.stock_photo_url.trim();
  }
  return out;
}

async function main() {
  const { limit, dryRun } = parseArgs();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (dryRun) {
    console.log("DRY RUN: no cache rows will be updated.\n");
  }

  console.log("Backfilling global_plant_cache: filling empty/failed rows with AI. Never overwriting existing data.");
  console.log(limit > 0 ? `Limit: ${limit} rows.` : "No limit — will process all rows that need filling.");
  console.log("");

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let offset = 0;

  while (true) {
    const { data: rows, error } = await admin
      .from("global_plant_cache")
      .select("id, source_url, identity_key, vendor, extract_data, original_hero_url, scrape_quality, updated_at")
      .range(offset, offset + BATCH_SIZE - 1)
      .order("updated_at", { ascending: true });

    if (error) {
      console.error("Fetch error:", error.message);
      process.exit(1);
    }
    if (!rows?.length) break;

    const typed = rows as CacheRow[];
    const needFilling = typed.filter(cacheRowNeedsFilling);

    for (const row of needFilling) {
      if (limit > 0 && totalProcessed >= limit) {
        console.log("\nReached --limit. Stopping.");
        break;
      }
      totalProcessed++;

      const ed = row.extract_data ?? {};
      const type = (String(ed.type ?? ed.plant_name ?? "").trim() || "Imported seed");
      const variety = String(ed.variety ?? ed.variety_name ?? "").trim();
      const vendor = (row.vendor ?? "").trim();
      const display = [type, variety].filter(Boolean).join(" — ") || row.identity_key;

      const result = await researchVariety(GEMINI_KEY, type, variety, vendor);
      if (!result) {
        console.log(`[${totalProcessed}] No AI result: ${display} | ${row.source_url.slice(0, 50)}...`);
        totalFailed++;
        await new Promise((r) => setTimeout(r, AI_DELAY_MS));
        continue;
      }

      const merged = mergeAiIntoExtractData(ed, result);
      const hasNewData = JSON.stringify(merged) !== JSON.stringify(ed);
      if (!hasNewData) {
        totalSkipped++;
        await new Promise((r) => setTimeout(r, AI_DELAY_MS));
        continue;
      }

      const scraped_fields = Object.keys(merged).filter((k) => merged[k] != null && merged[k] !== "");
      const newQuality = (row.scrape_quality === "failed" || !row.scrape_quality) ? "ai_only" : "partial";

      if (!dryRun) {
        const newHeroUrl = (merged.hero_image_url as string)?.trim().startsWith("http") ? (merged.hero_image_url as string).trim() : null;
        const { error: upErr } = await admin
          .from("global_plant_cache")
          .update({
            extract_data: merged,
            scraped_fields,
            scrape_quality: newQuality,
            ...(newHeroUrl ? { original_hero_url: newHeroUrl } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        if (upErr) {
          console.log(`[${totalProcessed}] Update failed: ${display}`, upErr.message);
          totalFailed++;
        } else {
          totalUpdated++;
          console.log(`[${totalProcessed}] Updated: ${display} | id=${row.id}`);
        }
      } else {
        totalUpdated++;
        console.log(`[${totalProcessed}] [DRY] Would update: ${display} | id=${row.id}`);
      }

      await new Promise((r) => setTimeout(r, AI_DELAY_MS));
    }

    offset += BATCH_SIZE;
    if (limit > 0 && totalProcessed >= limit) break;
    if (rows.length < BATCH_SIZE) break;
  }

  console.log("\nDone.");
  console.log("Updated:", totalUpdated, "| Skipped (no new data):", totalSkipped, "| Failed/no result:", totalFailed);
  if (totalUpdated > 0 && !dryRun) {
    console.log("Cache is now more complete. Re-run anytime to fill more rows.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
