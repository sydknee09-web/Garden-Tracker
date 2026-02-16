/**
 * Shared fill-in-blanks logic: cache lookup (global_plant_cache) and building
 * profile updates from a cache row. Used by fill-in-blanks route and fill-blanks-for-profile API.
 * Also writes AI-derived enrich data back to global_plant_cache so future lookups benefit.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripHtmlForDisplay } from "@/lib/htmlEntities";
import { normalizeVendorKey } from "@/lib/vendorNormalize";

const IMAGE_CHECK_TIMEOUT_MS = 5_000;

export function isPlaceholderHeroUrl(url: string | null | undefined): boolean {
  if (!url || !String(url).trim()) return false;
  const u = String(url).trim().toLowerCase();
  return u === "/seedling-icon.svg" || u.endsWith("/seedling-icon.svg");
}

function qualityRank(q: string): number {
  const rank: Record<string, number> = { full: 3, partial: 2, ai_only: 1, failed: 0 };
  return rank[q] ?? -1;
}

function pickBestCacheRow<T extends { scrape_quality?: string; updated_at?: string }>(rows: T[]): T | null {
  if (!rows?.length) return null;
  const sorted = [...rows].sort((a, b) => {
    const qA = qualityRank((a.scrape_quality ?? "").trim());
    const qB = qualityRank((b.scrape_quality ?? "").trim());
    if (qB !== qA) return qB - qA;
    const tA = new Date(a.updated_at ?? 0).getTime();
    const tB = new Date(b.updated_at ?? 0).getTime();
    return tB - tA;
  });
  return sorted[0] ?? null;
}

export async function checkImageAccessible(url: string): Promise<boolean> {
  if (!url?.startsWith("http")) return false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), IMAGE_CHECK_TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

function parseHarvestDays(s: string | undefined): number | null {
  if (typeof s !== "string" || !s.trim()) return null;
  const first = s.trim().replace(/,/g, "").match(/^\d+/);
  const n = first ? parseInt(first[0], 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

export type FillBlanksCacheRow = {
  extract_data: Record<string, unknown>;
  original_hero_url?: string | null;
  vendor?: string | null;
  scrape_quality?: string;
  updated_at?: string;
};

export type ProfileForFill = {
  sun?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
  scientific_name?: string | null;
  plant_description?: string | null;
  growing_notes?: string | null;
  water?: string | null;
  sowing_depth?: string | null;
  sowing_method?: string | null;
  planting_window?: string | null;
  hero_image_url?: string | null;
  hero_image_path?: string | null;
};

/** Build updates (metadata + hero) from a cache row. Never replace existing data — only fills empty profile fields. */
export async function buildUpdatesFromCacheRow(
  p: ProfileForFill,
  row: FillBlanksCacheRow
): Promise<Record<string, unknown>> {
  const ed = row.extract_data ?? {};
  const updates: Record<string, unknown> = {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "") || "";
  const heroFromRow =
    (row.original_hero_url as string)?.trim() ||
    (typeof ed.hero_image_url === "string" && ed.hero_image_url.trim()) ||
    "";
  let heroUrl = heroFromRow.startsWith("http") ? heroFromRow : "";
  if (heroUrl && !(await checkImageAccessible(heroUrl))) heroUrl = "";
  const currentUrl = (p.hero_image_url ?? "").trim();
  if (heroUrl && !(p.hero_image_path ?? "").trim() && (!currentUrl || isPlaceholderHeroUrl(currentUrl))) {
    updates.hero_image_url = heroUrl;
  }
  if (!(p.sun ?? "").trim() && str(ed.sun_requirement || ed.sun)) updates.sun = str(ed.sun_requirement || ed.sun);
  if (!(p.plant_spacing ?? "").trim() && str(ed.spacing || ed.plant_spacing)) updates.plant_spacing = str(ed.spacing || ed.plant_spacing);
  if (!(p.days_to_germination ?? "").trim() && str(ed.days_to_germination)) updates.days_to_germination = str(ed.days_to_germination);
  const maturityStr = str(ed.days_to_maturity);
  if ((p.harvest_days == null || p.harvest_days === 0) && maturityStr) {
    const parsed = parseHarvestDays(maturityStr);
    if (parsed != null) updates.harvest_days = parsed;
  }
  if (!(p.scientific_name ?? "").trim() && str(ed.scientific_name)) {
    const cleaned = stripHtmlForDisplay(str(ed.scientific_name));
    if (cleaned) updates.scientific_name = cleaned;
  }
  if (!(p.plant_description ?? "").trim() && str(ed.plant_description)) {
    updates.plant_description = str(ed.plant_description);
    updates.description_source = "vendor";
  }
  if (!(p.growing_notes ?? "").trim() && str(ed.growing_notes)) {
    updates.growing_notes = str(ed.growing_notes);
    if (!updates.description_source) updates.description_source = "vendor";
  }
  if (!(p.water ?? "").trim() && str(ed.water)) updates.water = str(ed.water);
  if (!(p.sowing_depth ?? "").trim() && str(ed.sowing_depth)) updates.sowing_depth = str(ed.sowing_depth);
  if (!(p.sowing_method ?? "").trim() && str(ed.sowing_method)) updates.sowing_method = str(ed.sowing_method);
  if (!(p.planting_window ?? "").trim() && str(ed.planting_window)) updates.planting_window = str(ed.planting_window);
  return updates;
}

/**
 * Look up best global_plant_cache row for a profile: Tier 0 by purchase_url, then Tier 1–3 by identity_key.
 */
export async function getBestCacheRow(
  supabase: SupabaseClient,
  identityKey: string,
  purchaseUrl: string | null | undefined,
  vendor: string
): Promise<FillBlanksCacheRow | null> {
  const vendorKey = vendor ? normalizeVendorKey(vendor) : "";

  if (purchaseUrl?.trim()?.startsWith("http")) {
    const { data: linkRow, error: linkErr } = await supabase
      .from("global_plant_cache")
      .select("id, extract_data, original_hero_url, vendor, scrape_quality, updated_at")
      .eq("source_url", purchaseUrl.trim())
      .maybeSingle();
    if (!linkErr && linkRow) return linkRow as FillBlanksCacheRow;
  }

  const { data: rows, error: cacheError } = await supabase
    .from("global_plant_cache")
    .select("id, extract_data, original_hero_url, vendor, scrape_quality, updated_at")
    .eq("identity_key", identityKey)
    .limit(10);

  const typedRows = (cacheError ? [] : (rows ?? [])) as FillBlanksCacheRow[];

  if (typedRows.length > 0 && vendorKey) {
    const byVendor = typedRows.filter((r) => normalizeVendorKey((r.vendor ?? "")) === vendorKey);
    if (byVendor.length > 0) return pickBestCacheRow(byVendor);
  }
  if (typedRows.length > 0) return pickBestCacheRow(typedRows);

  const typeKey = (identityKey.split("_")[0] ?? "").trim();
  if (!typeKey) return null;
  const { data: plantOnlyRows, error: plantErr } = await supabase
    .from("global_plant_cache")
    .select("id, extract_data, original_hero_url, vendor, scrape_quality, updated_at")
    .or(`identity_key.eq.${typeKey},identity_key.like.${typeKey}_%`)
    .limit(10);
  const plantRows = (plantErr ? [] : (plantOnlyRows ?? [])) as FillBlanksCacheRow[];
  return pickBestCacheRow(plantRows);
}

export type EnrichDataForCache = {
  plant_description?: string | null;
  growing_notes?: string | null;
  sun_requirement?: string | null;
  spacing?: string | null;
  days_to_germination?: string | null;
  days_to_maturity?: string | null;
  sowing_depth?: string | null;
  water?: string | null;
  sowing_method?: string | null;
  planting_window?: string | null;
};

/**
 * Write AI-derived enrich data to global_plant_cache so future fill-in-blanks lookups benefit.
 * Uses synthetic source_url enrich:${identity_key}:${vendorNorm}. Requires service-role admin client.
 */
export async function writeEnrichToGlobalCache(
  admin: ReturnType<typeof import("@/lib/supabaseAdmin").getSupabaseAdmin>,
  identityKey: string,
  vendor: string,
  type: string,
  variety: string,
  data: EnrichDataForCache
): Promise<void> {
  if (!admin || !identityKey?.trim()) return;
  const vendorNorm = normalizeVendorKey(vendor) || "default";
  const sourceUrl = `enrich:${identityKey}:${vendorNorm}`;
  const extract_data: Record<string, unknown> = {
    type: type || "Imported seed",
    variety: variety || "",
    vendor: vendor || "",
  };
  if (data.plant_description?.trim()) extract_data.plant_description = data.plant_description.trim();
  if (data.growing_notes?.trim()) extract_data.growing_notes = data.growing_notes.trim();
  if (data.sun_requirement?.trim()) extract_data.sun_requirement = data.sun_requirement.trim();
  if (data.spacing?.trim()) extract_data.spacing = data.spacing.trim();
  if (data.days_to_germination?.trim()) extract_data.days_to_germination = data.days_to_germination.trim();
  if (data.days_to_maturity?.trim()) extract_data.days_to_maturity = data.days_to_maturity.trim();
  if (data.sowing_depth?.trim()) extract_data.sowing_depth = data.sowing_depth.trim();
  if (data.water?.trim()) extract_data.water = data.water.trim();
  if (data.sowing_method?.trim()) extract_data.sowing_method = data.sowing_method.trim();
  if (data.planting_window?.trim()) extract_data.planting_window = data.planting_window.trim();

  const scraped_fields = Object.keys(extract_data).filter((k) => extract_data[k] != null && extract_data[k] !== "");

  try {
    await admin.from("global_plant_cache").upsert(
      {
        source_url: sourceUrl,
        identity_key: identityKey,
        vendor: vendor?.trim() || null,
        extract_data,
        scraped_fields,
        scrape_quality: "ai_enrich",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_url" }
    );
  } catch {
    // non-fatal
  }
}
