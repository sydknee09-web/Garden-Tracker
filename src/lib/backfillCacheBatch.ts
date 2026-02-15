/**
 * One-batch runner for backfill-global-cache. Used by the CLI script and the Developer API.
 * Fetches cache rows that need filling, runs AI, merges into extract_data, updates. Returns counts and hasMore.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { researchVariety } from "@/lib/researchVariety";

const BATCH_FETCH = 100;
const MAX_PROCESS_PER_BATCH = 20;
const AI_DELAY_MS = 2000;

type CacheRow = {
  id: string;
  source_url: string;
  identity_key: string;
  vendor: string | null;
  extract_data: Record<string, unknown>;
  scrape_quality: string | null;
  updated_at: string;
};

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

export type BackfillCacheResult = {
  updated: number;
  skipped: number;
  failed: number;
  hasMore: boolean;
  nextOffset?: number;
  message?: string;
};

export async function runBackfillCacheBatch(
  admin: SupabaseClient,
  options: { batchSize?: number; dryRun?: boolean; geminiKey: string; offset?: number }
): Promise<BackfillCacheResult> {
  const batchSize = options.batchSize ?? MAX_PROCESS_PER_BATCH;
  const dryRun = options.dryRun ?? false;
  const geminiKey = options.geminiKey.trim();
  const offset = options.offset ?? 0;

  const { data: rows, error } = await admin
    .from("global_plant_cache")
    .select("id, source_url, identity_key, vendor, extract_data, scrape_quality, updated_at")
    .range(offset, offset + BATCH_FETCH - 1)
    .order("updated_at", { ascending: true });

  if (error) {
    return { updated: 0, skipped: 0, failed: 0, hasMore: false, message: error.message };
  }
  if (!rows?.length) {
    return { updated: 0, skipped: 0, failed: 0, hasMore: false, nextOffset: offset + BATCH_FETCH };
  }

  const typed = rows as CacheRow[];
  const needFilling = typed.filter(cacheRowNeedsFilling).slice(0, batchSize);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of needFilling) {
    const ed = row.extract_data ?? {};
    const type = (String(ed.type ?? ed.plant_name ?? "").trim() || "Imported seed");
    const variety = String(ed.variety ?? ed.variety_name ?? "").trim();
    const vendor = (row.vendor ?? "").trim();

    const result = await researchVariety(geminiKey, type, variety, vendor);
    if (!result) {
      failed++;
      await new Promise((r) => setTimeout(r, AI_DELAY_MS));
      continue;
    }

    const merged = mergeAiIntoExtractData(ed, result);
    const hasNewData = JSON.stringify(merged) !== JSON.stringify(ed);
    if (!hasNewData) {
      skipped++;
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

      if (upErr) failed++;
      else updated++;
    } else {
      updated++;
    }

    await new Promise((r) => setTimeout(r, AI_DELAY_MS));
  }

  const hasMore = rows.length >= BATCH_FETCH;
  const nextOffset = offset + rows.length;
  return { updated, skipped, failed, hasMore, nextOffset };
}
