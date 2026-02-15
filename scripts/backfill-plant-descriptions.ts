/**
 * Backfill sparse plant_profiles: sun, plant_spacing, days_to_germination, harvest_days,
 * scientific_name, plant_description, growing_notes. Same logic as Settings "Fill in blanks":
 * cache lookup first (global_plant_cache by identity_key), then AI (researchVariety) with rate limiting.
 * Only fills empty cells (never overwrites existing data).
 *
 * Data sources:
 *   - Cache: global_plant_cache.extract_data from prior link imports or bulk-scrape (vendor scrape).
 *   - AI: Gemini + Google Search (researchVariety) when cache has no row or missing fields.
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
  console.log("Sources: cache = global_plant_cache from past link imports/bulk-scrape; AI = Gemini + Search when cache missing.\n");
  console.log("To verify in Supabase: Table Editor → plant_profiles → filter by id or description_source in ('vendor','ai').\n");

  const profileIds = profiles.map((p: { id: string }) => p.id);
  const { data: packets } = await admin
    .from("seed_packets")
    .select("plant_profile_id, vendor_name")
    .in("plant_profile_id", profileIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const vendorByProfile: Record<string, string> = {};
  (packets ?? []).forEach((row: { plant_profile_id: string; vendor_name: string | null }) => {
    if (vendorByProfile[row.plant_profile_id] == null) {
      vendorByProfile[row.plant_profile_id] = (row.vendor_name ?? "").trim() || "";
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

    if (!cacheErr && cacheRows?.length) {
      const filtered =
        vendorKey && cacheRows.length > 1
          ? cacheRows.filter((r: { vendor?: string | null }) => normalizeVendorKey((r.vendor ?? "")) === vendorKey)
          : cacheRows;
      const toSort = filtered.length ? filtered : cacheRows;
      const sorted = [...toSort].sort((a, b) => {
        const qA = qualityRank((a as { scrape_quality?: string }).scrape_quality ?? "");
        const qB = qualityRank((b as { scrape_quality?: string }).scrape_quality ?? "");
        if (qB !== qA) return qB - qA;
        const tA = new Date((a as { updated_at?: string }).updated_at ?? 0).getTime();
        const tB = new Date((b as { updated_at?: string }).updated_at ?? 0).getTime();
        return tB - tA;
      });
      const row = sorted[0] as { extract_data: Record<string, unknown> };
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

      if (Object.keys(updates).length > 0) {
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
            console.log(`[${i + 1}/${profiles.length}] From cache: ${displayName} | id=${p.id}`);
          }
        } else {
          fromCache++;
          console.log(`[${i + 1}/${profiles.length}] [DRY] Would fill from cache: ${displayName} | id=${p.id}`);
        }
        continue;
      }
    }

    if (!GEMINI_KEY) {
      console.log(`[${i + 1}/${profiles.length}] No cache, AI disabled: ${displayName} | id=${p.id}`);
      failed++;
      continue;
    }

    const result = await researchVariety(GEMINI_KEY, name, variety, vendor);
    const updates: Record<string, unknown> = {};
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
