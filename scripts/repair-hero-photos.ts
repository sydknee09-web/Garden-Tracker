/**
 * repair-hero-photos.ts — One-time script to find and set hero images for all
 * plant profiles that are missing one.
 *
 * Uses Supabase service role (direct DB, no dev server needed) and Google Gemini
 * 2.5 Flash with Google Search Grounding (same model/prompt as find-hero-photo API).
 *
 * Run:  npx tsx scripts/repair-hero-photos.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

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
const GEMINI_API_KEY = (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "").trim();
const USER_ID = (process.env.NEXT_PUBLIC_DEV_USER_ID ?? "").trim();

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.");
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error("ERROR: GOOGLE_GENERATIVE_AI_API_KEY not set.");
  process.exit(1);
}
if (!USER_ID) {
  console.error("ERROR: NEXT_PUBLIC_DEV_USER_ID not set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const HERO_SEARCH_PROMPT = `You are a professional botanical curator. Using Google Search Grounding, find an image URL that follows these rules:

Subject: Must show the actual growing plant, flower, or fruit (not a seed packet).
Quality: Prioritize high-resolution, clear lighting, and natural settings. Prioritize clear, well-lit images of the plant or fruit (for edible crops).
Strictly Prohibited: No seed packets, no hands/people, no cooked food, no cutting boards, and no watermarked stock previews (e.g. Alamy, Getty).
Preferred Sources: Look for educational sites, university extensions, or reputable nurseries (e.g. Rare Seeds, Johnny's, Wikimedia).

Return a single JSON object only (no markdown, no explanation):
- hero_image_url: a direct URL (https://...) to an image that meets the rules above. Use empty string if none found.

Return only valid JSON.`;

const PASS_TIMEOUT_MS = 20_000;
const IMAGE_CHECK_TIMEOUT_MS = 5_000;
const DELAY_BETWEEN_PROFILES_MS = 3_000;
const DELAY_BETWEEN_PASSES_MS = 1_500;

async function checkImageAccessible(url: string): Promise<boolean> {
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BLOCKED_DOMAINS = [
  "shutterstock.com", "alamy.com", "dreamstime.com", "istockphoto.com",
  "gettyimages.com", "123rf.com", "depositphotos.com", "stock.adobe.com",
];

function parseUrlFromResponse(text: string): string {
  if (!text) return "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return "";
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const raw =
      (typeof parsed.hero_image_url === "string" && parsed.hero_image_url.trim()) ||
      (typeof parsed.image_url === "string" && parsed.image_url.trim()) ||
      (typeof parsed.url === "string" && parsed.url.trim()) ||
      "";
    if (!raw.startsWith("http")) return "";
    const lower = raw.toLowerCase();
    if (BLOCKED_DOMAINS.some((d) => lower.includes(d))) return "";
    return raw;
  } catch {
    return "";
  }
}

async function searchWithTimeout(query: string, retries = 2): Promise<string> {
  const prompt = `${HERO_SEARCH_PROMPT}\n\nSearch for: ${query}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] },
        }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), PASS_TIMEOUT_MS)),
      ]);
      return response?.text?.trim() ?? "";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        const backoff = (attempt + 1) * 15_000;
        console.log(`rate limited, waiting ${backoff / 1000}s...`);
        await sleep(backoff);
        continue;
      }
      if (msg.includes("TIMEOUT")) return "";
      return "";
    }
  }
  return "";
}

async function findHeroForProfile(
  name: string,
  variety: string,
  vendor: string,
  scientificName: string,
  identityKey: string
): Promise<string> {
  // Tier 1: Check global_plant_cache
  if (identityKey) {
    const { data: gpcRows } = await supabase
      .from("global_plant_cache")
      .select("original_hero_url, extract_data")
      .eq("identity_key", identityKey)
      .order("updated_at", { ascending: false })
      .limit(5);
    if (gpcRows?.length) {
      for (const row of gpcRows) {
        const orig = (row.original_hero_url as string)?.trim();
        if (orig?.startsWith("http") && (await checkImageAccessible(orig))) return orig;
        const ed = row.extract_data as Record<string, unknown> | undefined;
        const fromExtract = typeof ed?.hero_image_url === "string" ? ed.hero_image_url.trim() : "";
        if (fromExtract.startsWith("http") && (await checkImageAccessible(fromExtract))) return fromExtract;
      }
    }
  }

  // Tier 2: Gemini AI search
  // Accept URLs without strict HEAD check — many image hosts block server HEAD
  // but serve fine to browsers. The app's fallback chain handles broken images.
  const varietyPart = (variety || "").replace(/\bSeeds\b/gi, "").replace(/\bSeed\b/gi, "").replace(/\s+/g, " ").trim();
  const cleanName = name.toLowerCase();
  let searchQuery = varietyPart;
  if (cleanName && !varietyPart.toLowerCase().includes(cleanName)) {
    searchQuery = `${varietyPart} ${name}`.trim();
  }
  searchQuery = searchQuery || name || "plant";

  // Pass 1: detailed query
  const primaryQuery = `${searchQuery} botanical close-up "on the vine" OR "in the garden" -packet -seeds -plate -food`;
  let text = await searchWithTimeout(primaryQuery);
  let url = parseUrlFromResponse(text);
  if (url) return url;

  await sleep(DELAY_BETWEEN_PASSES_MS);

  // Pass 2: simpler query
  const fallbackQuery = `${searchQuery} botanical close-up -packet -seeds -plate -food`;
  text = await searchWithTimeout(fallbackQuery);
  url = parseUrlFromResponse(text);
  if (url) return url;

  await sleep(DELAY_BETWEEN_PASSES_MS);

  // Pass 3: flower/plant query
  const flowerQuery = `${name} ${variety} flower plant`.replace(/\s+/g, " ").trim();
  text = await searchWithTimeout(flowerQuery);
  url = parseUrlFromResponse(text);
  if (url) return url;

  await sleep(DELAY_BETWEEN_PASSES_MS);

  // Pass 4: type + variety + botanical
  if (name || variety) {
    const botanicalQuery = `${name} ${variety} botanical`.replace(/\s+/g, " ").trim();
    text = await searchWithTimeout(botanicalQuery);
    url = parseUrlFromResponse(text);
    if (url) return url;
    await sleep(DELAY_BETWEEN_PASSES_MS);
  }

  // Pass 5: scientific name
  if (scientificName) {
    const sciQuery = `${scientificName} ${variety} -site:rareseeds.com high resolution botanical -packet -seeds -plate -food`.replace(/\s+/g, " ").trim();
    text = await searchWithTimeout(sciQuery);
    url = parseUrlFromResponse(text);
    if (url) return url;
  }

  return "";
}

// Inline identityKeyFromVariety to avoid import path issues in standalone script
function getCanonicalKey(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}
function identityKeyFromVariety(type: string, variety: string): string {
  const typeKey = getCanonicalKey(type);
  const varietyKey = getCanonicalKey(variety);
  if (!typeKey && !varietyKey) return "";
  return typeKey && varietyKey ? `${typeKey}_${varietyKey}` : typeKey || varietyKey;
}

async function main() {
  console.log("Querying plant profiles missing hero images...\n");

  const { data: profiles, error } = await supabase
    .from("plant_profiles")
    .select("id, name, variety_name, scientific_name, hero_image_url, hero_image_path")
    .eq("user_id", USER_ID)
    .is("deleted_at", null);

  if (error) {
    console.error("Failed to query profiles:", error.message);
    process.exit(1);
  }

  const needsRepair = (profiles ?? []).filter((p) => {
    const hasPath = (p.hero_image_path ?? "").trim();
    if (hasPath) return false;
    const url = (p.hero_image_url ?? "").trim();
    if (!url) return true;
    return url.endsWith("seedling-icon.svg");
  });

  console.log(`Found ${profiles?.length ?? 0} total profiles, ${needsRepair.length} need hero images.\n`);

  if (needsRepair.length === 0) {
    console.log("All profiles already have hero images. Nothing to do.");
    return;
  }

  // Get vendor info from seed_packets
  const profileIds = needsRepair.map((p) => p.id);
  const { data: packets } = await supabase
    .from("seed_packets")
    .select("plant_profile_id, vendor_name")
    .eq("user_id", USER_ID)
    .in("plant_profile_id", profileIds);
  const vendorByProfile: Record<string, string> = {};
  (packets ?? []).forEach((row: { plant_profile_id: string; vendor_name: string | null }) => {
    if (!vendorByProfile[row.plant_profile_id]) {
      vendorByProfile[row.plant_profile_id] = (row.vendor_name ?? "").trim();
    }
  });

  let updated = 0;
  let failed = 0;
  let cached = 0;

  for (let i = 0; i < needsRepair.length; i++) {
    const p = needsRepair[i];
    const name = (p.name ?? "").trim() || "Unknown";
    const variety = (p.variety_name ?? "").trim();
    const vendor = vendorByProfile[p.id] ?? "";
    const scientificName = (p.scientific_name ?? "").trim();
    const identityKey = identityKeyFromVariety(name, variety);
    const label = `${name}${variety ? ` - ${variety}` : ""}`;

    process.stdout.write(`[${i + 1}/${needsRepair.length}] ${label}... `);

    try {
      const heroUrl = await findHeroForProfile(name, variety, vendor, scientificName, identityKey);
      if (heroUrl) {
        const { error: updateErr } = await supabase
          .from("plant_profiles")
          .update({ hero_image_url: heroUrl })
          .eq("id", p.id)
          .eq("user_id", USER_ID);
        if (updateErr) {
          console.log(`UPDATE FAILED: ${updateErr.message}`);
          failed++;
        } else {
          // Also write to global cache so other users benefit
          if (identityKey) {
            const vendorNorm = (vendor || "").toLowerCase().replace(/[^a-z0-9]/g, "_") || "unknown";
            await supabase
              .from("global_plant_cache")
              .upsert(
                {
                  source_url: `repair:${identityKey}:${vendorNorm}`,
                  identity_key: identityKey,
                  vendor: vendor || null,
                  extract_data: { type: name, variety, vendor, hero_image_url: heroUrl },
                  original_hero_url: heroUrl,
                  scraped_fields: ["type", "variety", "hero_image_url"],
                  scrape_quality: "ai_hero",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "source_url" }
              )
              .then(() => {});
          }
          console.log(`OK (${heroUrl.slice(0, 60)}...)`);
          updated++;
        }
      } else {
        console.log("NO IMAGE FOUND");
        failed++;
      }
    } catch (e) {
      console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }

    // Delay between profiles to avoid rate limiting
    if (i < needsRepair.length - 1) {
      await sleep(DELAY_BETWEEN_PROFILES_MS);
    }
  }

  console.log(`\n--- Done ---`);
  console.log(`Updated: ${updated}`);
  console.log(`From cache: ${cached}`);
  console.log(`No image found: ${failed}`);
  console.log(`Total: ${needsRepair.length}`);
}

main().catch((e) => {
  console.error("Script failed:", e);
  process.exit(1);
});
