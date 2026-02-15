/**
 * Backfill plant_description and growing_notes for profiles that are missing them.
 * Uses same logic as Settings "Fill in blanks": cache lookup first, then AI (researchVariety) with rate limiting.
 *
 * Prerequisites:
 *   - Migration 20250227000000_plant_profiles_description_notes.sql applied (plant_description, growing_notes columns).
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_GENERATIVE_AI_API_KEY (optional for AI fallback).
 *
 * Run:
 *   npx tsx scripts/backfill-plant-descriptions.ts
 *   npx tsx scripts/backfill-plant-descriptions.ts --limit 20
 *   npx tsx scripts/backfill-plant-descriptions.ts --dry-run
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

async function main() {
  const { limit, dryRun } = parseArgs();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (dryRun) {
    console.log("DRY RUN: no updates will be written.\n");
  }

  const { data: profiles, error: listError } = await admin
    .from("plant_profiles")
    .select("id, user_id, name, variety_name, plant_description, growing_notes")
    .is("deleted_at", null)
    .or("plant_description.is.null,plant_description.eq.")
    .limit(limit);

  if (listError) {
    console.error("Failed to list profiles:", listError.message);
    process.exit(1);
  }
  if (!profiles?.length) {
    console.log("No profiles missing plant_description.");
    return;
  }

  console.log(`Found ${profiles.length} profile(s) missing description (limit ${limit}).\n`);

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

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i] as {
      id: string;
      user_id: string;
      name: string;
      variety_name: string | null;
      plant_description?: string | null;
      growing_notes?: string | null;
    };
    const name = (p.name ?? "").trim() || "Imported seed";
    const variety = (p.variety_name ?? "").trim();
    const identityKey = identityKeyFromVariety(name, variety);
    const displayName = [name, variety].filter(Boolean).join(" — ") || name;

    if (!identityKey) {
      console.log(`[${i + 1}/${profiles.length}] Skip (no identity): ${displayName}`);
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
      const desc = typeof ed.plant_description === "string" ? ed.plant_description.trim() : "";
      const notes = typeof ed.growing_notes === "string" ? ed.growing_notes.trim() : "";

      if (desc || notes) {
        const updates: Record<string, unknown> = { description_source: "vendor" };
        if (desc) updates.plant_description = desc;
        if (notes) updates.growing_notes = notes;
        if (!dryRun) {
          const { error: upErr } = await admin
            .from("plant_profiles")
            .update(updates)
            .eq("id", p.id)
            .eq("user_id", p.user_id);
          if (upErr) {
            console.log(`[${i + 1}/${profiles.length}] Cache hit but update failed: ${displayName}`, upErr.message);
            failed++;
          } else {
            fromCache++;
            console.log(`[${i + 1}/${profiles.length}] From cache: ${displayName}`);
          }
        } else {
          fromCache++;
          console.log(`[${i + 1}/${profiles.length}] [DRY] Would fill from cache: ${displayName}`);
        }
        continue;
      }
    }

    if (!GEMINI_KEY) {
      console.log(`[${i + 1}/${profiles.length}] No cache, AI disabled: ${displayName}`);
      failed++;
      continue;
    }

    const result = await researchVariety(GEMINI_KEY, name, variety, vendor);
    if (result?.plant_description?.trim() || result?.growing_notes?.trim()) {
      const updates: Record<string, unknown> = { description_source: "ai" };
      if (result.plant_description?.trim()) updates.plant_description = result.plant_description.trim();
      if (result.growing_notes?.trim()) updates.growing_notes = result.growing_notes.trim();
      if (!dryRun) {
        const { error: upErr } = await admin
          .from("plant_profiles")
          .update(updates)
          .eq("id", p.id)
          .eq("user_id", p.user_id);
        if (upErr) {
          console.log(`[${i + 1}/${profiles.length}] AI ok but update failed: ${displayName}`, upErr.message);
          failed++;
        } else {
          fromAi++;
          console.log(`[${i + 1}/${profiles.length}] From AI: ${displayName}`);
        }
      } else {
        fromAi++;
        console.log(`[${i + 1}/${profiles.length}] [DRY] Would fill from AI: ${displayName}`);
      }
    } else {
      console.log(`[${i + 1}/${profiles.length}] No cache, no AI result: ${displayName}`);
      failed++;
    }

    if (GEMINI_KEY && i < profiles.length - 1) {
      await new Promise((r) => setTimeout(r, AI_DELAY_MS));
    }
  }

  console.log("\nDone. From cache:", fromCache, "| From AI:", fromAi, "| Failed/skip:", failed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
