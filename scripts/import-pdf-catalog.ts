/**
 * import-pdf-catalog.ts — Extract text from a vendor PDF catalog, parse plant/seed
 * rows with Gemini, and upsert into global_plant_cache so they appear in Quick Add
 * and link-import lookups (identity + vendor).
 *
 * Use when the vendor has no website: you have a PDF price list or catalog.
 *
 * Prerequisites:
 *   - .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_GENERATIVE_AI_API_KEY
 *
 * Run:
 *   npx tsx scripts/import-pdf-catalog.ts "C:\path\to\catalog.pdf" "Vendor Name"
 *   npx tsx scripts/import-pdf-catalog.ts "C:\path\to\geo-price-g26_merged-1.pdf" "Geo Seed"
 *
 * Each row gets a synthetic source_url: catalog:vendor-slug#identity_key
 * so the same plant from the same catalog upserts (no duplicates).
 */

import { createRequire } from "module";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { parseCatalogWithGemini, toCacheRow } from "../src/lib/importPdfCatalog";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
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

/** Extract raw text from PDF using pdf-parse. */
async function extractTextFromPdf(pdfPath: string): Promise<{ text: string; numpages: number }> {
  const pdfParse = require("pdf-parse");
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  return { text: (data.text ?? "").trim(), numpages: data.numpages ?? 0 };
}

async function upsertGlobalCache(
  supabase: ReturnType<typeof createClient>,
  row: {
    source_url: string;
    identity_key: string;
    vendor: string;
    extract_data: Record<string, unknown>;
    original_hero_url: null;
    scraped_fields: string[];
    scrape_quality: string;
  }
): Promise<boolean> {
  const { error } = await supabase.from("global_plant_cache").upsert(
    { ...row, updated_at: new Date().toISOString() },
    { onConflict: "source_url" }
  );
  return !error;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const pdfPath = args[0];
  const vendorName = (args[1] ?? "").trim();

  if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.error("Usage: npx tsx scripts/import-pdf-catalog.ts <path-to-catalog.pdf> \"Vendor Name\"");
    console.error("Example: npx tsx scripts/import-pdf-catalog.ts \"C:\\Users\\...\\geo-price-g26_merged-1.pdf\" \"Geo Seed\"");
    process.exit(1);
  }
  if (!vendorName) {
    console.error("Vendor name is required (e.g. \"Geo Seed\").");
    process.exit(1);
  }
  if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR_PROJECT_REF")) {
    console.error("NEXT_PUBLIC_SUPABASE_URL missing or placeholder. Set it in .env.local.");
    process.exit(1);
  }
  if (!SERVICE_ROLE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY not set. Set it in .env.local.");
    process.exit(1);
  }

  console.log("Reading PDF:", pdfPath);
  const { text, numpages } = await extractTextFromPdf(pdfPath);
  if (!text || text.length < 50) {
    console.error("PDF produced too little text. Is it scanned (image-only)? If so, use OCR first or try a different PDF.");
    process.exit(1);
  }
  console.log("Extracted", text.length, "chars from", numpages, "page(s). Sending to Gemini...");

  const rawRows = await parseCatalogWithGemini(text, vendorName);
  console.log("Parsed", rawRows.length, "raw rows. Normalizing and upserting...");

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let inserted = 0;
  let skipped = 0;
  for (const raw of rawRows) {
    const row = toCacheRow(raw, vendorName);
    if (!row) {
      skipped++;
      continue;
    }
    const ok = await upsertGlobalCache(supabase, {
      source_url: row.source_url,
      identity_key: row.identity_key,
      vendor: vendorName,
      extract_data: row.extract_data,
      original_hero_url: null,
      scraped_fields: row.scraped_fields,
      scrape_quality: "catalog_import",
    });
    if (ok) inserted++;
    else console.warn("Failed to upsert:", row.identity_key);
  }

  console.log("Done. Inserted/updated:", inserted, "| Skipped:", skipped);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
