/**
 * Backfill sparse plant_profiles: sun, plant_spacing, days_to_germination, harvest_days,
 * scientific_name, plant_description, growing_notes. Same logic as Settings "Fill in blanks":
 * cache lookup with a three-tier cascade, then AI (researchVariety) when cache has nothing.
 * Only fills empty cells (never overwrites existing data).
 *
 * Never replace existing data — only fill empty fields.
 *
 * Cache lookup order (fill from first tier that has data):
 *   0. Link: if profile has a packet with purchase_url (or profile link), look up global_plant_cache by that source_url first.
 *   1. Vendor + variety + plant (same vendor, same identity_key)
 *   2. Variety + plant (any vendor, same identity_key)
 *   3. Plant only (any variety, any vendor — identity_key = type or starts with type_)
 *   Then: AI when no cache row had the needed fields.
 *
 * When AI fills a profile, we also upsert that result into global_plant_cache so the cache grows
 * and future lookups (for you or other users) can use it — no scrape or AI needed next time.
 *
 * Prerequisites:
 *   - Migration 20250227000000_plant_profiles_description_notes.sql applied.
 *   - .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_GENERATIVE_AI_API_KEY (optional for AI).
 *
 * Run:
 *   npm run backfill-plant-descriptions
 *   npm run backfill-plant-descriptions -- --limit 20
 *   npm run backfill-plant-descriptions -- --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "../src/lib/identityKey";
import { getCanonicalKey } from "../src/lib/canonicalKey";
import { normalizeVendorKey } from "../src/lib/vendorNormalize";
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
  console.error("ERROR: GOOGLE_GENERATIVE_AI_API_KEY missing. AI fallback disabled. Set in .env.local to use AI.");
}

const DEFAULT_LIMIT = 50;
const AI_DELAY_MS = 2000;

function parseArgs(): { limit: number; dryRun: boolean } {
  const args = process.argv.slice(2);
  let limit = DEFAULT_LIMIT;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10) || DEFAULT_LIMIT;
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }
  return { limit, dryRun };
}

function qualityRank(q: string): number {
  const rank: Record<string, number> = { full: 3, partial: 2, ai_only: 1, failed: 0, user_import: 2 };
  return rank[q] ?? -1;
}

/** Parse "65" or "55-70" to number (first number). */
function parseHarvestDays(s: string | undefined): number | null {
  if (typeof s !== "string" || !s.trim()) return null;
  const first = s.trim().replace(/,/g, "").match(/^\d+/);
  const n = first ? parseInt(first[0], 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** True if profile has at least one empty key field we can backfill. */
function isSparse(p: {
  sun?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
  scientific_name?: string | null;
  plant_description?: string | null;
  growing_notes?: string | null;
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
    !hasStr(p.growing_notes)
  );
}

type CacheRow = { id: string; extract_data: Record<string, unknown>; vendor?: string | null; scrape_quality?: string; updated_at?: string };

/** Build updates for plant_profiles from a cache row. Never replace existing data — only adds values for empty profile fields. */
function buildUpdatesFromCacheRow(
  p: {
    sun?: string | null;
    plant_spacing?: string | null;
    days_to_germination?: string | null;
    harvest_days?: number | null;
    scientific_name?: string | null;
    plant_description?: string | null;
    growing_notes?: string | null;
  },
  row: CacheRow
): Record<string, unknown> {
  const ed = row.extract_data ?? {};
  const updates: Record<string, unknown> = {};
  if (!(p.sun ?? "").trim() && typeof ed.sun_requirement === "string" && (ed.sun_requirement as string).trim()) {
    updates.sun = (ed.sun_requirement as string).trim();
  }
  if (!(p.plant_spacing ?? "").trim() && typeof ed.spacing === "string" && (ed.spacing as string).trim()) {
    updates.plant_spacing = (ed.spacing as string).trim();
  }
  if (!(p.days_to_germination ?? "").trim() && typeof ed.days_to_germination === "string" && (ed.days_to_germination as string).trim()) {
    updates.days_to_germination = (ed.days_to_germination as string).trim();
  }
  const maturityStr = typeof ed.days_to_maturity === "string" ? (ed.days_to_maturity as string).trim() : "";
  if ((p.harvest_days == null || p.harvest_days === 0) && maturityStr) {
    const parsed = parseHarvestDays(maturityStr);
    if (parsed != null) updates.harvest_days = parsed;
  }
  if (!(p.scientific_name ?? "").trim() && typeof ed.scientific_name === "string" && (ed.scientific_name as string).trim()) {
    updates.scientific_name = (ed.scientific_name as string).trim();
  }
  if (!(p.plant_description ?? "").trim() && typeof ed.plant_description === "string" && (ed.plant_description as string).trim()) {
    updates.plant_description = (ed.plant_description as string).trim();
    updates.description_source = "vendor";
  }
  if (!(p.growing_notes ?? "").trim() && typeof ed.growing_notes === "string" && (ed.growing_notes as string).trim()) {
    updates.growing_notes = (ed.growing_notes as string).trim();
    if (!updates.description_source) updates.description_source = "vendor";
  }
  return updates;
}

/** Pick best cache row by scrape_quality then updated_at. */
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

async function main() {
  const { limit, dryRun } = parseArgs();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (dryRun) {
    console.log("DRY RUN: no updates will be written.\n");
  }

  const { data: rawProfiles, error: listError } = await admin
    .from("plant_profiles")
    .select("id, user_id, name, variety_name, sun, plant_spacing, days_to_germination, harvest_days, scientific_name, plant_description, growing_notes")
    .is("deleted_at", null)
    .or("plant_description.is.null,sun.is.null,plant_spacing.is.null,days_to_germination.is.null,harvest_days.is.null,scientific_name.is.null")
    .limit(limit * 2);

  if (listError) {
    console.error("Failed to list profiles:", listError.message);
    process.exit(1);
  }

  const profiles = (rawProfiles ?? []).filter((p: Record<string, unknown>) => isSparse(p as Parameters<typeof isSparse>[0])).slice(0, limit);
  if (!profiles.length) {
    console.log("No sparse profiles (all key fields already filled).");
    return;
  }

  console.log(`Found ${profiles.length} profile(s) with at least one empty field (sun, spacing, germination, harvest_days, scientific_name, description, notes).`);
  console.log("Cache lookup order: 0) link (by purchase_url)  1) vendor+variety+plant  2) variety+plant  3) plant only. Never replace existing data. Then AI when cache has nothing.\n");
  console.log("To verify in Supabase: Table Editor → plant_profiles → filter by id or description_source in ('vendor','ai').\n");

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
  const updatedIds: string[] = [];

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i] as {
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
    };
    const name = (p.name ?? "").trim() || "Imported seed";
    const variety = (p.variety_name ?? "").trim();
    const identityKey = identityKeyFromVariety(name, variety);
    const displayName = [name, variety].filter(Boolean).join(" — ") || name;

    if (!identityKey) {
      console.log(`[${i + 1}/${profiles.length}] Skip (no identity): ${displayName} | id=${p.id}`);
      failed++;
      continue;
    }

    const vendor = vendorByProfile[p.id] ?? "";
    const vendorKey = vendor ? normalizeVendorKey(vendor) : "";

    const { data: cacheRows, error: cacheErr } = await admin
      .from("global_plant_cache")
      .select("id, extract_data, vendor, scrape_quality, updated_at")
      .eq("identity_key", identityKey)
      .limit(10);

    const typedCacheRows = (cacheErr ? [] : (cacheRows ?? [])) as CacheRow[];
    let updates: Record<string, unknown> = {};
    let tierUsed: "link" | "vendor_variety_plant" | "variety_plant" | "plant" | null = null;

    // Tier 0: link — if we have a purchase/source URL, look up cache by that URL first (never replace existing data)
    const linkUrl = urlByProfile[p.id]?.trim();
    if (linkUrl && Object.keys(updates).length === 0) {
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

    // Tier 1: vendor + variety + plant (same vendor, same identity_key)
    if (Object.keys(updates).length === 0 && typedCacheRows.length > 0 && vendorKey) {
      const byVendor = typedCacheRows.filter((r) => normalizeVendorKey((r.vendor ?? "")) === vendorKey);
      if (byVendor.length > 0) {
        const best = pickBestCacheRow(byVendor);
        if (best) {
          updates = buildUpdatesFromCacheRow(p, best);
          if (Object.keys(updates).length > 0) tierUsed = "vendor_variety_plant";
        }
      }
    }

    // Tier 2: variety + plant (any vendor)
    if (Object.keys(updates).length === 0 && typedCacheRows.length > 0) {
      const best = pickBestCacheRow(typedCacheRows);
      if (best) {
        updates = buildUpdatesFromCacheRow(p, best);
        if (Object.keys(updates).length > 0) tierUsed = "variety_plant";
      }
    }

    // Tier 3: plant only (any variety, any vendor)
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
        const { error: upErr } = await admin
          .from("plant_profiles")
          .update(updates)
          .eq("id", p.id)
          .eq("user_id", p.user_id);
        if (upErr) {
          console.log(`[${i + 1}/${profiles.length}] Cache hit but update failed: ${displayName} | id=${p.id}`, upErr.message);
          failed++;
        } else {
          fromCache++;
          updatedIds.push(p.id);
          console.log(`[${i + 1}/${profiles.length}] From cache (${tierUsed}): ${displayName} | id=${p.id}`);
        }
      } else {
        fromCache++;
        console.log(`[${i + 1}/${profiles.length}] [DRY] Would fill from cache (${tierUsed}): ${displayName} | id=${p.id}`);
      }
      continue;
    }

    if (!GEMINI_KEY) {
      console.log(`[${i + 1}/${profiles.length}] No cache, AI disabled: ${displayName} | id=${p.id}`);
      failed++;
      continue;
    }

    const result = await researchVariety(GEMINI_KEY, name, variety, vendor);
    updates = {};
    if (result) {
      if (!(p.sun ?? "").trim() && result.sun_requirement?.trim()) updates.sun = result.sun_requirement.trim();
      if (!(p.plant_spacing ?? "").trim() && result.spacing?.trim()) updates.plant_spacing = result.spacing.trim();
      if (!(p.days_to_germination ?? "").trim() && result.days_to_germination?.trim()) updates.days_to_germination = result.days_to_germination.trim();
      if ((p.harvest_days == null || p.harvest_days === 0) && result.days_to_maturity?.trim()) {
        const parsed = parseHarvestDays(result.days_to_maturity);
        if (parsed != null) updates.harvest_days = parsed;
      }
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
        const { error: upErr } = await admin
          .from("plant_profiles")
          .update(updates)
          .eq("id", p.id)
          .eq("user_id", p.user_id);
        if (upErr) {
          console.log(`[${i + 1}/${profiles.length}] AI ok but update failed: ${displayName} | id=${p.id}`, upErr.message);
          failed++;
        } else {
          fromAi++;
          updatedIds.push(p.id);
          console.log(`[${i + 1}/${profiles.length}] From AI: ${displayName} | id=${p.id}`);
          // Write AI result to global_plant_cache so future lookups (and new plants) can use it
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
              hero_image_url: result.stock_photo_url?.trim().startsWith("http") ? result.stock_photo_url.trim() : undefined,
            };
            const scraped_fields = Object.keys(extractData).filter((k) => extractData[k] != null && extractData[k] !== "");
            const { error: cacheErr } = await admin.from("global_plant_cache").upsert(
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
            if (cacheErr) {
              console.log(`[${i + 1}/${profiles.length}] Cache write failed (profile still updated):`, cacheErr.message);
            }
          }
        }
      } else {
        fromAi++;
        console.log(`[${i + 1}/${profiles.length}] [DRY] Would fill from AI: ${displayName} | id=${p.id}`);
      }
    } else {
      console.log(`[${i + 1}/${profiles.length}] No cache, no AI result: ${displayName} | id=${p.id}`);
      failed++;
    }

    if (GEMINI_KEY && i < profiles.length - 1) {
      await new Promise((r) => setTimeout(r, AI_DELAY_MS));
    }
  }

  console.log("\nDone. From cache:", fromCache, "| From AI:", fromAi, "| Failed/skip:", failed);
  if (updatedIds.length > 0 && !dryRun) {
    console.log("\nUpdated profile IDs (use in Supabase to verify):");
    console.log(updatedIds.join("\n"));
    console.log("\nSupabase: Table Editor → plant_profiles → filter 'id' is one of these, or filter description_source in ('vendor','ai').");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
