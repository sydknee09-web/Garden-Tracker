/**
 * One-time script: normalize existing global_plant_cache rows so identity_key and
 * extract_data (type, variety, tags) match the shared pipeline used by link import,
 * photo import, and bulk-scrape. Run after deploying the shared identity + normalization.
 *
 * Prerequisites: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Run: npx ts-node -r tsconfig-paths/register scripts/normalize-global-plant-cache.ts
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

import { createClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { stripPlantFromVariety, cleanVarietyForDisplay } from "@/lib/varietyNormalize";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const { data: rows, error: selectError } = await admin
    .from("global_plant_cache")
    .select("id, source_url, identity_key, extract_data");
  if (selectError) {
    console.error("Select failed:", selectError.message);
    process.exit(1);
  }
  if (!rows?.length) {
    console.log("No rows in global_plant_cache.");
    return;
  }
  console.log(`Found ${rows.length} rows. Normalizing...`);
  let updated = 0;
  let skipped = 0;
  for (const row of rows as { id: string; source_url: string; identity_key: string; extract_data: Record<string, unknown> }[]) {
    const ed = row.extract_data ?? {};
    let typeNorm = String(ed.type ?? ed.plant_name ?? "").trim() || "";
    let varietyNorm = String(ed.variety ?? ed.variety_name ?? "").trim();
    varietyNorm = stripPlantFromVariety(varietyNorm, typeNorm);
    const { cleanedVariety, tagsToAdd } = cleanVarietyForDisplay(varietyNorm, typeNorm);
    varietyNorm = cleanedVariety;
    const tagsRaw = Array.isArray(ed.tags) ? (ed.tags as string[]).filter((t) => typeof t === "string").map((t) => String(t).trim()).filter(Boolean) : [];
    const tagsMerged = [...tagsRaw];
    for (const t of tagsToAdd) {
      if (t && !tagsMerged.some((x) => x.toLowerCase() === t.toLowerCase())) tagsMerged.push(t);
    }
    const newIdentityKey = identityKeyFromVariety(typeNorm || "Imported seed", varietyNorm);
    if (!newIdentityKey) {
      skipped++;
      continue;
    }
    const newExtractData = {
      ...ed,
      type: typeNorm || "Imported seed",
      variety: varietyNorm,
      tags: tagsMerged,
    };
    const { error: updateError } = await admin
      .from("global_plant_cache")
      .update({ identity_key: newIdentityKey, extract_data: newExtractData, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) {
      console.warn("Update failed for", row.source_url?.slice(0, 50), updateError.message);
      continue;
    }
    updated++;
  }
  console.log(`Done. Updated: ${updated}, skipped: ${skipped}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
