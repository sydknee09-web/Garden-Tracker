/**
 * One-batch runner for backfill-plant-descriptions. Used by the CLI script and the Developer API.
 * Fetches up to batchSize sparse profiles, fills from cache or AI, updates DB. Returns counts and hasMore.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { getCanonicalKey } from "@/lib/canonicalKey";
import { normalizeVendorKey } from "@/lib/vendorNormalize";
import { researchVariety } from "@/lib/researchVariety";

const AI_DELAY_MS = 2000;

function parseHarvestDays(s: string | undefined): number | null {
  if (typeof s !== "string" || !s.trim()) return null;
  const first = s.trim().replace(/,/g, "").match(/^\d+/);
  const n = first ? parseInt(first[0], 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

function isSparse(p: {
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
}): boolean {
  const hasStr = (v: string | null | undefined) => v != null && String(v).trim() !== "";
  const hasHarvest = (v: number | null | undefined) =>
    v != null && typeof v === "number" && Number.isFinite(v) && v > 0;
  return (
    !hasStr(p.sun) ||
    !hasStr(p.plant_spacing) ||
    !hasStr(p.days_to_germination) ||
    !hasHarvest(p.harvest_days) ||
    !hasStr(p.scientific_name) ||
    !hasStr(p.plant_description) ||
    !hasStr(p.growing_notes) ||
    !hasStr(p.water) ||
    !hasStr(p.sowing_depth) ||
    !hasStr(p.sowing_method) ||
    !hasStr(p.planting_window)
  );
}

type CacheRow = { id: string; extract_data: Record<string, unknown>; vendor?: string | null; scrape_quality?: string; updated_at?: string };

function qualityRank(q: string): number {
  const rank: Record<string, number> = { full: 3, partial: 2, ai_only: 1, failed: 0, user_import: 2 };
  return rank[q] ?? -1;
}

function buildUpdatesFromCacheRow(
  p: {
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
  },
  row: CacheRow
): Record<string, unknown> {
  const ed = row.extract_data ?? {};
  const updates: Record<string, unknown> = {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "") || "";
  if (!(p.sun ?? "").trim() && str(ed.sun_requirement || ed.sun)) updates.sun = str(ed.sun_requirement || ed.sun);
  if (!(p.plant_spacing ?? "").trim() && str(ed.spacing || ed.plant_spacing)) updates.plant_spacing = str(ed.spacing || ed.plant_spacing);
  if (!(p.days_to_germination ?? "").trim() && str(ed.days_to_germination)) updates.days_to_germination = str(ed.days_to_germination);
  const maturityStr = str(ed.days_to_maturity);
  if ((p.harvest_days == null || p.harvest_days === 0) && maturityStr) {
    const parsed = parseHarvestDays(maturityStr);
    if (parsed != null) updates.harvest_days = parsed;
  }
  if (!(p.scientific_name ?? "").trim() && str(ed.scientific_name)) updates.scientific_name = str(ed.scientific_name);
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

export type BackfillPlantDescriptionsResult = {
  fromCache: number;
  fromAi: number;
  failed: number;
  hasMore: boolean;
  message?: string;
};

export async function runBackfillPlantDescriptionsBatch(
  admin: SupabaseClient,
  options: { batchSize?: number; dryRun?: boolean; geminiKey?: string; onGeminiCall?: () => void }
): Promise<BackfillPlantDescriptionsResult> {
  const batchSize = options.batchSize ?? 50;
  const dryRun = options.dryRun ?? false;
  const geminiKey = (options.geminiKey ?? "").trim();
  const onGeminiCall = options.onGeminiCall;

  const { data: rawProfiles, error: listError } = await admin
    .from("plant_profiles")
    .select("id, user_id, name, variety_name, sun, plant_spacing, days_to_germination, harvest_days, scientific_name, plant_description, growing_notes, water, sowing_depth, sowing_method, planting_window")
    .is("deleted_at", null)
    .or("plant_description.is.null,sun.is.null,plant_spacing.is.null,days_to_germination.is.null,harvest_days.is.null,scientific_name.is.null,water.is.null,sowing_depth.is.null,sowing_method.is.null,planting_window.is.null")
    .limit(batchSize * 2);

  if (listError) {
    return { fromCache: 0, fromAi: 0, failed: 0, hasMore: false, message: listError.message };
  }

  const profiles = (rawProfiles ?? []).filter((p: Record<string, unknown>) => isSparse(p as Parameters<typeof isSparse>[0])).slice(0, batchSize);
  if (!profiles.length) {
    return { fromCache: 0, fromAi: 0, failed: 0, hasMore: false };
  }

  const profileIds = profiles.map((p: { id: string }) => p.id);
  const { data: packets } = await admin
    .from("seed_packets")
    .select("plant_profile_id, vendor_name, purchase_url")
    .in("plant_profile_id", profileIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const vendorByProfile: Record<string, string> = {};
  const urlByProfile: Record<string, string> = {};
  (packets ?? []).forEach((row: { plant_profile_id: string; vendor_name: string | null; purchase_url?: string | null }) => {
    if (vendorByProfile[row.plant_profile_id] == null) {
      vendorByProfile[row.plant_profile_id] = (row.vendor_name ?? "").trim() || "";
    }
    if (urlByProfile[row.plant_profile_id] == null) {
      const url = (row.purchase_url ?? "").trim();
      if (url && url.startsWith("http")) urlByProfile[row.plant_profile_id] = url;
    }
  });

  let fromCache = 0;
  let fromAi = 0;
  let failed = 0;

  type P = {
    id: string;
    user_id: string;
    name: string;
    variety_name: string | null;
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
  };

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i] as P;
    const name = (p.name ?? "").trim() || "Imported seed";
    const variety = (p.variety_name ?? "").trim();
    const identityKey = identityKeyFromVariety(name, variety);

    if (!identityKey) {
      failed++;
      continue;
    }

    const vendor = vendorByProfile[p.id] ?? "";
    const vendorKey = vendor ? normalizeVendorKey(vendor) : "";
    const linkUrl = urlByProfile[p.id]?.trim();

    const { data: cacheRows, error: cacheErr } = await admin
      .from("global_plant_cache")
      .select("id, extract_data, vendor, scrape_quality, updated_at")
      .eq("identity_key", identityKey)
      .limit(10);

    const typedCacheRows = (cacheErr ? [] : (cacheRows ?? [])) as CacheRow[];
    let updates: Record<string, unknown> = {};
    let tierUsed: string | null = null;

    if (linkUrl) {
      const { data: linkRow, error: linkErr } = await admin
        .from("global_plant_cache")
        .select("id, extract_data, vendor, scrape_quality, updated_at")
        .eq("source_url", linkUrl)
        .maybeSingle();
      if (!linkErr && linkRow) {
        updates = buildUpdatesFromCacheRow(p, linkRow as CacheRow);
        if (Object.keys(updates).length > 0) tierUsed = "link";
      }
    }

    if (Object.keys(updates).length === 0 && typedCacheRows.length > 0 && vendorKey) {
      const byVendor = typedCacheRows.filter((r) => normalizeVendorKey((r.vendor ?? "")) === vendorKey);
      const best = byVendor.length > 0 ? pickBestCacheRow(byVendor) : null;
      if (best) {
        updates = buildUpdatesFromCacheRow(p, best);
        if (Object.keys(updates).length > 0) tierUsed = "vendor_variety_plant";
      }
    }

    if (Object.keys(updates).length === 0 && typedCacheRows.length > 0) {
      const best = pickBestCacheRow(typedCacheRows);
      if (best) {
        updates = buildUpdatesFromCacheRow(p, best);
        if (Object.keys(updates).length > 0) tierUsed = "variety_plant";
      }
    }

    if (Object.keys(updates).length === 0) {
      const typeKey = getCanonicalKey(name);
      if (typeKey) {
        const { data: plantOnlyRows, error: plantErr } = await admin
          .from("global_plant_cache")
          .select("id, extract_data, vendor, scrape_quality, updated_at")
          .or(`identity_key.eq.${typeKey},identity_key.like.${typeKey}_%`)
          .limit(10);
        const plantRows = (plantErr ? [] : (plantOnlyRows ?? [])) as CacheRow[];
        const best = pickBestCacheRow(plantRows);
        if (best) {
          updates = buildUpdatesFromCacheRow(p, best);
          if (Object.keys(updates).length > 0) tierUsed = "plant";
        }
      }
    }

    if (Object.keys(updates).length > 0 && tierUsed) {
      if (!dryRun) {
        const { error: upErr } = await admin.from("plant_profiles").update(updates).eq("id", p.id).eq("user_id", p.user_id);
        if (upErr) failed++;
        else fromCache++;
      } else {
        fromCache++;
      }
      if (geminiKey && i < profiles.length - 1) await new Promise((r) => setTimeout(r, 100));
      continue;
    }

    if (!geminiKey) {
      failed++;
      continue;
    }

    onGeminiCall?.();
    const result = await researchVariety(geminiKey, name, variety, vendor);
    updates = {};
    if (result) {
      if (!(p.sun ?? "").trim() && result.sun_requirement?.trim()) updates.sun = result.sun_requirement.trim();
      if (!(p.plant_spacing ?? "").trim() && result.spacing?.trim()) updates.plant_spacing = result.spacing.trim();
      if (!(p.days_to_germination ?? "").trim() && result.days_to_germination?.trim()) updates.days_to_germination = result.days_to_germination.trim();
      if ((p.harvest_days == null || p.harvest_days === 0) && result.days_to_maturity?.trim()) {
        const parsed = parseHarvestDays(result.days_to_maturity);
        if (parsed != null) updates.harvest_days = parsed;
      }
      if (!(p.water ?? "").trim() && result.water?.trim()) updates.water = result.water.trim();
      if (!(p.sowing_depth ?? "").trim() && result.sowing_depth?.trim()) updates.sowing_depth = result.sowing_depth.trim();
      if (!(p.sowing_method ?? "").trim() && result.sowing_method?.trim()) updates.sowing_method = result.sowing_method.trim();
      if (!(p.planting_window ?? "").trim() && result.planting_window?.trim()) updates.planting_window = result.planting_window.trim();
      if (result.plant_description?.trim()) {
        updates.plant_description = result.plant_description.trim();
        updates.description_source = "ai";
      }
      if (result.growing_notes?.trim()) {
        updates.growing_notes = result.growing_notes.trim();
        if (!updates.description_source) updates.description_source = "ai";
      }
    }

    if (Object.keys(updates).length > 0) {
      if (!dryRun) {
        const { error: upErr } = await admin.from("plant_profiles").update(updates).eq("id", p.id).eq("user_id", p.user_id);
        if (upErr) {
          failed++;
        } else {
          fromAi++;
          if (result) {
            const cacheSourceUrl =
              (result.source_url?.trim().startsWith("http") ? result.source_url.trim() : null) ||
              linkUrl ||
              `https://backfill-ai.local/${identityKey}`;
            const extractData: Record<string, unknown> = {
              type: name,
              variety,
              vendor: vendor || "",
              source_url: cacheSourceUrl,
              tags: [],
              sun_requirement: result.sun_requirement?.trim() || undefined,
              spacing: result.spacing?.trim() || undefined,
              days_to_germination: result.days_to_germination?.trim() || undefined,
              days_to_maturity: result.days_to_maturity?.trim() || undefined,
              plant_description: result.plant_description?.trim() || undefined,
              growing_notes: result.growing_notes?.trim() || undefined,
              sowing_depth: result.sowing_depth?.trim() || undefined,
              water: result.water?.trim() || undefined,
              sowing_method: result.sowing_method?.trim() || undefined,
              planting_window: result.planting_window?.trim() || undefined,
              hero_image_url: result.stock_photo_url?.trim().startsWith("http") ? result.stock_photo_url.trim() : undefined,
            };
            const scraped_fields = Object.keys(extractData).filter((k) => extractData[k] != null && extractData[k] !== "");
            await admin.from("global_plant_cache").upsert(
              {
                source_url: cacheSourceUrl,
                identity_key: identityKey,
                vendor: vendor || null,
                extract_data: extractData,
                original_hero_url: result.stock_photo_url?.trim().startsWith("http") ? result.stock_photo_url.trim() : null,
                scraped_fields,
                scrape_quality: "ai_only",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "source_url" }
            );
          }
        }
      } else {
        fromAi++;
      }
    } else {
      failed++;
    }

    if (i < profiles.length - 1) await new Promise((r) => setTimeout(r, AI_DELAY_MS));
  }

  const hasMore = profiles.length >= batchSize;
  return { fromCache, fromAi, failed, hasMore };
}
