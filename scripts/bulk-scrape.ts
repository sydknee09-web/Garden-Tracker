/**
 * bulk-scrape.ts — Feed discovered vendor URLs through the existing scraper
 * and store results in global_plant_cache via Supabase service-role client.
 *
 * Prerequisites:
 *   1. Run `npx ts-node scripts/discover-urls.ts` first to generate data/vendor-urls.json
 *   2. Dev server running: npm run dev
 *   3. Environment vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:  npm run bulk-scrape
 *       (default: round-robin = 1 URL per vendor per round, 4 vendors in parallel for ~4x speed, same per-vendor rate)
 *       npm run bulk-scrape -- --parallel   (legacy: 4 vendors at a time, each does full queue)
 *       npm run bulk-scrape -- --ai          (enable Tavily AI fallback when keys available)
 *       npm run bulk-scrape -- --vendor rareseeds.com
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { identityKeyFromVariety } from "../src/lib/identityKey";
import { stripPlantFromVariety, cleanVarietyForDisplay } from "../src/lib/varietyNormalize";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local from project root so env vars are set when run via ts-node (no need to set in PowerShell)
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

// ── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = process.env.SCRAPE_TEST_BASE_URL ?? "http://localhost:3000";
const API_PATH = "/api/seed/scrape-url";
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR_PROJECT_REF")) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL is missing or still the placeholder.");
  console.error("Edit .env.local and set it to your real Supabase URL (e.g. https://xxxx.supabase.co).");
  console.error("Find it in Supabase Dashboard → Project Settings → API → Project URL.");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY is not set.");
  console.error("Edit .env.local and set it to your service_role key (Supabase Dashboard → Project Settings → API → service_role).");
  process.exit(1);
}

/** Max vendor streams running in parallel */
const MAX_PARALLEL_VENDORS = 4;

/** Jittered delay between requests to same vendor: 2-4s */
const DELAY_BASE_MS = 2000;
const DELAY_JITTER_MS = 2000;

/** Retry failed URLs once after this cooldown */
const RETRY_COOLDOWN_MS = 30_000;

// ── Supabase service-role client (bypasses RLS) ──────────────────────────────
async function upsertGlobalCache(row: {
  source_url: string;
  identity_key: string;
  vendor: string;
  extract_data: Record<string, unknown>;
  original_hero_url: string | null;
  scraped_fields: string[];
  scrape_quality: string;
}): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/global_plant_cache`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      ...row,
      updated_at: new Date().toISOString(),
    }),
  });
  return res.ok;
}

async function isAlreadyCached(sourceUrl: string): Promise<boolean> {
  const encoded = encodeURIComponent(sourceUrl);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/global_plant_cache?source_url=eq.${encoded}&select=id&limit=1`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

/** Fetch existing scrape_quality for a cached URL, or null if not cached. */
async function getCachedQuality(sourceUrl: string): Promise<string | null> {
  const encoded = encodeURIComponent(sourceUrl);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/global_plant_cache?source_url=eq.${encoded}&select=scrape_quality&limit=1`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const q = (data[0] as { scrape_quality?: string } | null)?.scrape_quality;
  return typeof q === "string" ? q : null;
}

/** Quality order: higher = better. Only overwrite cache when new quality >= existing. */
const QUALITY_RANK: Record<string, number> = { full: 3, partial: 2, ai_only: 1, failed: 0 };
function qualityRank(q: string): number {
  return QUALITY_RANK[q] ?? -1;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function jitteredDelay(): Promise<void> {
  const ms = DELAY_BASE_MS + Math.random() * DELAY_JITTER_MS;
  return new Promise((r) => setTimeout(r, ms));
}

function getVendorDomain(urlString: string): string {
  try {
    return new URL(urlString).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/** Normalize domain to display name (match extract/route vendorFromUrl for vault/packet display). */
const VENDOR_NORMALIZE_MAP: { pattern: RegExp; vendor: string }[] = [
  { pattern: /rareseeds\.com/i, vendor: "Rare Seeds" },
  { pattern: /hudsonvalleyseed/i, vendor: "Hudson Valley Seed Co" },
  { pattern: /floretflowers\.com/i, vendor: "Floret" },
];

function getVendorDisplayName(domain: string): string {
  for (const { pattern, vendor } of VENDOR_NORMALIZE_MAP) {
    if (pattern.test(domain)) return vendor;
  }
  const name = domain.split(".")[0] ?? domain;
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build identity_key using shared formula (must match vault/link import for cache-by-identity). */
function buildIdentityKey(type: string, variety: string): string {
  const key = identityKeyFromVariety(type, variety);
  return key || "unknown";
}

const JOHNNYS_TOP_CATEGORIES = ["vegetables", "flowers", "herbs", "tools", "supplies"];
const JOHNNYS_PRODUCT_CODE = /-\d+[a-z]*$/i;

function toTitle(s: string): string {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/** Derive type and variety from URL path when the scraper returns empty or wrong (e.g. product code as type). */
function deriveTypeAndVarietyFromUrl(url: string): { type: string; variety: string } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname;
    const segments = pathname.split("/").filter(Boolean);
    const last = (segments[segments.length - 1] ?? "").replace(/\.[^.]*$/, "").replace(/_/g, "-").trim();

    if (host.includes("burpee.com") && last) {
      const parts = last.split("-").filter(Boolean);
      if (parts.length >= 1) {
        const type = toTitle(parts[0]!);
        const variety = parts.length > 1 ? toTitle(parts.slice(1).join("-")) : "";
        return { type: type || "Imported seed", variety: variety || "Unknown" };
      }
    }

    // High Mowing: slug organic-non-gmo-spretnak-lettuce-p-m005 → Lettuce / Spretnak (so identity_key is not pelleted_*)
    if (host.includes("highmowingseeds.com") && last) {
      const slugNoCode = last.replace(/-p?-m?\d+$/i, "").replace(/-+$/, "").trim();
      const parts = slugNoCode.split("-").filter(Boolean);
      const noise = ["organic", "non", "gmo", "pelleted", "seeds", "seed"];
      const meaningful = parts.filter((p) => !noise.includes(p.toLowerCase()));
      if (meaningful.length >= 2) {
        const type = toTitle(meaningful[meaningful.length - 1]!);
        const variety = toTitle(meaningful.slice(0, -1).join(" "));
        return { type, variety: variety || "Unknown" };
      }
      if (meaningful.length === 1) return { type: toTitle(meaningful[0]!), variety: "Unknown" };
    }

    // Outsidepride: derive from path + slug only (no default "Flower"). sweet-violet-seeds-reine-de-neiges → Sweet Viola / Reine De Neiges; stokesia-seeds-white-star → Stokesia / White Star
    if (host.includes("outsidepride.com") && last) {
      const lower = last.toLowerCase();
      const categorySegment = segments.length >= 2 ? (segments[segments.length - 2] ?? "").replace(/\.[^.]*$/, "").trim() : "";
      if (lower.includes("-seeds-")) {
        const idx = lower.indexOf("-seeds-");
        const leftPart = last.slice(0, idx).replace(/-/g, " ").trim();
        const rightPart = last.slice(idx + 7).replace(/-/g, " ").trim();
        if (leftPart && rightPart) {
          let type = toTitle(leftPart);
          if (type === "Sweet Violet") type = "Sweet Viola";
          return { type, variety: toTitle(rightPart) || "Unknown" };
        }
      }
      const categoryLower = categorySegment.toLowerCase().replace(/-/g, " ");
      let plantBase = "";
      if (categorySegment && categoryLower !== "flower-seed" && categoryLower !== "flower") {
        plantBase = categorySegment.endsWith("-seeds") ? categorySegment.slice(0, -6) : categorySegment;
      }
      if (!plantBase) plantBase = (lower.split("-seeds-")[0] ?? "").replace(/-/g, " ");
      if (plantBase) {
        const type = toTitle(plantBase.replace(/-/g, " "));
        const prefix = (plantBase.toLowerCase().replace(/\s+/g, "-") + "-seeds-");
        const varietySlug = lower.startsWith(prefix) ? lower.slice(prefix.length).replace(/-/g, " ") : "";
        return { type, variety: varietySlug ? toTitle(varietySlug) : "Unknown" };
      }
    }

    if (host.includes("edenbrothers.com") && last) {
      const lower = last.toLowerCase();
      // Underscore slugs: annual_phlox_seeds_dwarf_mixed → Phlox / Dwarf Mixed; mixed_annual_phlox_seeds → Phlox / Mixed
      const parts = last.replace(/-/g, "_").split("_").filter(Boolean);
      const partsLower = parts.map((p) => p.toLowerCase());
      const phloxIdx = partsLower.indexOf("phlox");
      const seedsIdx = partsLower.indexOf("seeds");
      const annualIdx = partsLower.indexOf("annual");
      if (phloxIdx !== -1 && seedsIdx !== -1 && seedsIdx >= phloxIdx) {
        let variety = "";
        if (seedsIdx + 1 < parts.length) {
          variety = parts.slice(seedsIdx + 1).join(" ");
        } else if (annualIdx !== -1 && annualIdx > 0) {
          variety = parts.slice(0, annualIdx).join(" ");
        } else if (phloxIdx > 0) {
          variety = parts.slice(0, phloxIdx).join(" ");
        }
        variety = toTitle(variety.trim());
        return { type: "Phlox", variety: variety || "Unknown" };
      }
      if (lower.includes("-seeds-")) {
        const idx = lower.indexOf("-seeds-");
        const plantPart = last.slice(0, idx).replace(/-/g, " ").trim();
        const varietyPart = last.slice(idx + 7).replace(/-/g, " ").trim();
        if (plantPart && varietyPart) {
          return { type: toTitle(plantPart), variety: toTitle(varietyPart) };
        }
      }
      const m = last.match(/^(.+?)-(pepper|tomato|lettuce|cucumber|bean|squash)s?-seeds?$/i);
      if (m) {
        const varietyPart = m[1]!.replace(/^organic-?/i, "").replace(/-/g, " ").trim();
        if (varietyPart) {
          return { type: toTitle(m[2]!), variety: toTitle(varietyPart) };
        }
      }
      // Underscore: dwarf_nasturtium_seeds → Nasturtium / Dwarf
      const partsEd = last.replace(/-/g, "_").split("_").filter(Boolean);
      const partsLowerEd = partsEd.map((p) => p.toLowerCase());
      const nasturtiumIdxEd = partsLowerEd.indexOf("nasturtium");
      const seedsIdxEd = partsLowerEd.indexOf("seeds");
      if (nasturtiumIdxEd !== -1 && seedsIdxEd !== -1 && seedsIdxEd > nasturtiumIdxEd) {
        const varietyEd = partsEd.slice(0, nasturtiumIdxEd).join(" ");
        if (varietyEd) return { type: "Nasturtium", variety: toTitle(varietyEd) };
      }
      // Hyphen/slug: nasturtium-alaska-mix → Nasturtium / Alaska Mix
      if (partsLowerEd[0] === "nasturtium" && partsEd.length >= 2) {
        const varietyEd = partsEd.slice(1).join(" ");
        if (varietyEd) return { type: "Nasturtium", variety: toTitle(varietyEd) };
      }
    }

    const SWALLOWTAIL_TOP = ["annuals", "perennials", "herbs", "vegetables", "bulk", "flowering-vines"];
    if (host.includes("swallowtailgardenseeds.com") && segments.length >= 1 && last) {
      const pathSegments = segments.slice(0, -1);
      const plantSegment = pathSegments[pathSegments.length - 1] ?? "";
      if (!SWALLOWTAIL_TOP.includes(plantSegment.toLowerCase())) {
        let type = toTitle(plantSegment);
        if (type.endsWith("s") && type.length > 1) type = type.slice(0, -1);
        let varietySlug = last.replace(/-seeds?$/gi, "").replace(/-flower(s)?$/gi, "").trim();
        const typeLower = type.toLowerCase();
        if (varietySlug.toLowerCase().endsWith(typeLower)) {
          varietySlug = varietySlug.slice(0, -typeLower.length).replace(/-+$/, "").trim();
        }
        const variety = varietySlug && varietySlug.toLowerCase() !== typeLower ? toTitle(varietySlug.replace(/-/g, " ")) : "";
        return { type, variety: variety || "Unknown" };
      }
      const parts = last.split("-").filter(Boolean);
      const type = parts.length ? toTitle(parts[0]!) : "Imported seed";
      const variety = parts.length > 1 ? toTitle(parts.slice(1).join("-")) : "";
      return { type, variety: variety || "Unknown" };
    }

    // Johnny's: two-part URL (e.g. /herbs/stevia) → slug is plant; 3+ parts → last path segment = plant, slug = variety.
    if (host.includes("johnnyseeds.com") && segments.length >= 2) {
      const slugWithoutCode = last.replace(JOHNNYS_PRODUCT_CODE, "").replace(/-+$/, "").trim();
      if (segments.length === 2) {
        // category/slug only — slug is the plant name (e.g. stevia)
        const type = slugWithoutCode
          ? slugWithoutCode.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim()
          : "";
        if (type) return { type, variety: "Unknown" };
      } else {
        const plantSegment = segments[segments.length - 2] ?? "";
        const type = plantSegment
          ? plantSegment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim()
          : "";
        let variety = slugWithoutCode
          .replace(/-organic\b/gi, "")
          .replace(/-lettuce\b/gi, "")
          .replace(/-seeds?\b/gi, "")
          .replace(/-bean(-seed)?$/gi, "")
          .replace(/-+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim();
        if (type && variety.toLowerCase().endsWith(type.toLowerCase())) {
          variety = variety.slice(0, -type.length).trim();
        }
        if (type || variety) {
          return { type: type || "Imported seed", variety: variety || "Unknown" };
        }
      }
    }

    const parent = (segments[segments.length - 2] ?? "").replace(/_/g, " ").replace(/-/g, " ").trim();
    let variety = last
      .replace(/-seeds?$/i, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    let type = "";
    if (parent && parent.length >= 2 && !/^[\d\s]+$/.test(parent)) {
      type = parent.replace(/\b\w/g, (c) => c.toUpperCase()).trim();
    }
    if (!type && variety) {
      const words = variety.split(/\s+/);
      const lastWord = words[words.length - 1] ?? "";
      if (words.length > 1 && lastWord.length >= 2) {
        type = lastWord;
        variety = words.slice(0, -1).join(" ").trim();
      }
    }
    if (!type) type = "Imported seed";
    return { type, variety: variety || "Unknown" };
  } catch {
    return { type: "Imported seed", variety: "Unknown" };
  }
}

/** Fields we track for quality reporting */
const TRACKED_FIELDS = [
  "sun", "water", "plant_spacing", "days_to_germination", "harvest_days",
  "plant_description", "growing_notes", "imageUrl", "latin_name",
  "life_cycle", "hybrid_status",
] as const;

function collectScrapedFields(data: Record<string, unknown>): string[] {
  const found: string[] = [];
  for (const key of TRACKED_FIELDS) {
    const v = data[key];
    if (v == null) continue;
    if (typeof v === "string" && v.trim()) found.push(key);
    if (typeof v === "number" && !Number.isNaN(v)) found.push(key);
  }
  return found;
}

function determineScrapeQuality(data: Record<string, unknown>): string {
  const status = (data.scrape_status as string) ?? "";
  if (status === "AI_SEARCH") return "ai_only";
  if (status === "Failed") return "failed";
  if (status === "Success") return "full";
  return "partial";
}

// ── Progress tracking ────────────────────────────────────────────────────────
interface ProgressData {
  completed: Record<string, string[]>;  // vendor -> completed URLs
  failed: Record<string, string[]>;     // vendor -> failed URLs
  /** Round-robin only: next URL index per vendor */
  nextIndex?: Record<string, number>;
  stats: {
    total_scraped: number;
    total_failed: number;
    total_cached: number;
    started_at: string;
    last_updated: string;
  };
}

function loadProgress(filePath: string): ProgressData {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch { /* fresh start */ }
  return {
    completed: {},
    failed: {},
    stats: {
      total_scraped: 0,
      total_failed: 0,
      total_cached: 0,
      started_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    },
  };
}

function saveProgress(filePath: string, progress: ProgressData): void {
  progress.stats.last_updated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2), "utf-8");
}

// ── Scrape one URL ───────────────────────────────────────────────────────────
interface ScrapeResult {
  url: string;
  success: boolean;
  quality: string;
  fieldsFound: number;
  error?: string;
}

async function scrapeOne(url: string, noAi: boolean): Promise<ScrapeResult> {
  try {
    const body: Record<string, unknown> = { url };
    if (noAi) {
      // The scraper checks for this flag to skip AI fallback
      body.skipAiFallback = true;
    }

    const res = await fetch(`${BASE_URL}${API_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok || data.error) {
      return {
        url,
        success: false,
        quality: "failed",
        fieldsFound: 0,
        error: (data.error as string) ?? `HTTP ${res.status}`,
      };
    }

    const domain = getVendorDomain(url);
    const vendor = getVendorDisplayName(domain);
    let typeNorm = String(data.plant_name ?? data.ogTitle ?? "").trim() || "";
    let varietyNorm = String(data.variety_name ?? "").trim();
    // When scraper returns empty type/variety (e.g. some Select Seeds / Swallowtail pages), derive from URL slug so we still cache
    if (!typeNorm.trim() || !varietyNorm.trim()) {
      const fromUrl = deriveTypeAndVarietyFromUrl(url);
      if (!typeNorm.trim()) typeNorm = fromUrl.type;
      if (!varietyNorm.trim()) varietyNorm = fromUrl.variety;
    }
    // Johnny's: if API returned a product code as type (e.g. 2326ng), derive type/variety from URL so cache stays correct
    if (domain.includes("johnnyseeds.com") && /^\d+[a-z]*$/i.test(typeNorm)) {
      const fromUrl = deriveTypeAndVarietyFromUrl(url);
      typeNorm = fromUrl.type;
      varietyNorm = fromUrl.variety;
    }
    // Burpee: if API returned a product code as type (e.g. Prod600097), derive from URL slug
    if (domain.includes("burpee.com") && /^prod\d+$/i.test(typeNorm)) {
      const fromUrl = deriveTypeAndVarietyFromUrl(url);
      typeNorm = fromUrl.type;
      varietyNorm = fromUrl.variety;
    }
    // Eden Brothers: if variety collapsed to generic "Hot" or "Sweet" (peppers), derive from URL slug
    if (domain.includes("edenbrothers.com") && /^(hot|sweet)$/i.test(varietyNorm.trim())) {
      const fromUrl = deriveTypeAndVarietyFromUrl(url);
      if (fromUrl.variety && fromUrl.variety !== "Unknown") {
        typeNorm = fromUrl.type;
        varietyNorm = fromUrl.variety;
      }
    }
    // Swallowtail: if type is "General" (wrong for category pages), derive from URL path
    if (domain.includes("swallowtailgardenseeds.com") && /^general$/i.test(typeNorm.trim())) {
      const fromUrl = deriveTypeAndVarietyFromUrl(url);
      if (fromUrl.type && fromUrl.type !== "Imported seed") {
        typeNorm = fromUrl.type;
        varietyNorm = fromUrl.variety;
      }
    }
    // Same normalization as link import and extract image branch: strip plant from variety, clean variety, merge tags
    varietyNorm = stripPlantFromVariety(varietyNorm, typeNorm);
    const { cleanedVariety, tagsToAdd } = cleanVarietyForDisplay(varietyNorm, typeNorm);
    varietyNorm = cleanedVariety;
    const tagsRaw = Array.isArray(data.tags) ? (data.tags as string[]).filter((t) => typeof t === "string").map((t) => String(t).trim()).filter(Boolean) : [];
    const tagsMerged = [...tagsRaw];
    for (const t of tagsToAdd) {
      if (t && !tagsMerged.some((x) => x.toLowerCase() === t.toLowerCase())) tagsMerged.push(t);
    }
    const identityKey = buildIdentityKey(typeNorm || "Imported seed", varietyNorm);
    const scrapedFields = collectScrapedFields(data);
    const quality = determineScrapeQuality(data);

    // Validation: skip upsert if no usable identity — treat as fail so we don't persist junk and can retry after parser fixes
    if (!typeNorm.trim() || !varietyNorm.trim() || !identityKey || identityKey === "unknown") {
      console.warn(`[bulk-scrape] Fail (no identity): missing type/variety/identity_key for ${url}`);
      return { url, success: false, quality: "failed", fieldsFound: scrapedFields.length, error: "Missing type/variety" };
    }
    // Treat "General" as fail: don't write to cache; URL stays in failed list for retry when parser improves
    if (/^general$/i.test(typeNorm.trim())) {
      console.warn(`[bulk-scrape] Fail (General): unresolved plant name for ${url}`);
      return { url, success: false, quality: "failed", fieldsFound: scrapedFields.length, error: "Plant name could not be determined (General)" };
    }
    // Reject identity_key patterns that indicate bad extraction (generic "Flower" type only; allow sunflower_*)
    const BAD_IDENTITY_PATTERNS = /pelleted|floret_|general_|^flower_|days_|from_|mix_/i;
    if (BAD_IDENTITY_PATTERNS.test(identityKey)) {
      console.warn(`[bulk-scrape] Fail (bad identity_key): ${identityKey} for ${url}`);
      return { url, success: false, quality: "failed", fieldsFound: scrapedFields.length, error: "Identity key indicates failed extraction" };
    }

    // Extract hero image URL
    const heroUrl =
      (data.imageUrl as string) ??
      (data.hero_image_url as string) ??
      (data.stock_photo_url as string) ??
      null;

    const rawHarvestDays = data.harvest_days;
    const daysToMaturityStr =
      typeof rawHarvestDays === "number" && Number.isFinite(rawHarvestDays)
        ? String(rawHarvestDays)
        : typeof rawHarvestDays === "string" && rawHarvestDays.trim()
          ? rawHarvestDays.trim()
          : undefined;

    // Build extract_data: same shape as extract-metadata / Tier 0 so link import and lookup-by-identity consume one format
    const extractData: Record<string, unknown> = {
      type: typeNorm || "Imported seed",
      variety: varietyNorm,
      vendor,
      tags: tagsMerged,
      source_url: url,
      sowing_depth: data.sowing_depth ?? undefined,
      spacing: data.plant_spacing ?? undefined,
      sun_requirement: data.sun ?? undefined,
      days_to_germination: data.days_to_germination ?? undefined,
      days_to_maturity: daysToMaturityStr,
      scientific_name: data.latin_name ?? undefined,
      hero_image_url: heroUrl ?? undefined,
      plant_description: data.plant_description ?? undefined,
      growing_notes: data.growing_notes ?? undefined,
      life_cycle: data.life_cycle ?? undefined,
      hybrid_status: data.hybrid_status ?? undefined,
      water: (data.water as string)?.trim() || undefined,
      sun: data.sun ?? undefined,
      plant_spacing: data.plant_spacing ?? undefined,
      harvest_days: typeof rawHarvestDays === "number" && Number.isFinite(rawHarvestDays) ? rawHarvestDays : undefined,
    };

    // Only overwrite cache if new quality is better than or equal to existing (never replace good data with worse)
    const existingQuality = await getCachedQuality(url);
    const existingRank = existingQuality !== null ? qualityRank(existingQuality) : -1;
    const newRank = qualityRank(quality);
    if (existingRank > newRank) {
      // Keep existing row; don't overwrite. Still report success so we mark URL completed and don't retry forever.
      return { url, success: true, quality: existingQuality ?? quality, fieldsFound: scrapedFields.length };
    }

    // Upsert into global_plant_cache (vendor = display name for RLS/index; domain not stored in row)
    const cached = await upsertGlobalCache({
      source_url: url,
      identity_key: identityKey,
      vendor,
      extract_data: extractData,
      original_hero_url: heroUrl,
      scraped_fields: scrapedFields,
      scrape_quality: quality,
    });

    if (!cached) {
      return {
        url,
        success: false,
        quality,
        fieldsFound: scrapedFields.length,
        error: "Failed to upsert into global_plant_cache",
      };
    }

    return { url, success: true, quality, fieldsFound: scrapedFields.length };
  } catch (err) {
    return {
      url,
      success: false,
      quality: "failed",
      fieldsFound: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Process one vendor's URLs ────────────────────────────────────────────────
async function processVendor(
  domain: string,
  urls: string[],
  progress: ProgressData,
  progressFile: string,
  noAi: boolean
): Promise<{ scraped: number; failed: number; skipped: number }> {
  const completed = new Set(progress.completed[domain] ?? []);
  const pendingUrls = urls.filter((u) => !completed.has(u));

  if (pendingUrls.length === 0) {
    console.log(`  [${domain}] All ${urls.length} URLs already processed, skipping.`);
    return { scraped: 0, failed: 0, skipped: urls.length };
  }

  console.log(`  [${domain}] ${pendingUrls.length} pending (${completed.size} already done)`);

  let scraped = 0;
  let failed = 0;
  const skipped = urls.length - pendingUrls.length;
  const failedUrls: string[] = [];

  for (let i = 0; i < pendingUrls.length; i++) {
    const url = pendingUrls[i]!;

    // Check if already in global cache (resumability)
    const alreadyCached = await isAlreadyCached(url);
    if (alreadyCached) {
      if (!progress.completed[domain]) progress.completed[domain] = [];
      progress.completed[domain]!.push(url);
      progress.stats.total_cached++;
      continue;
    }

    // Jittered delay between requests
    if (i > 0) await jitteredDelay();

    const result = await scrapeOne(url, noAi);

    if (result.success) {
      scraped++;
      progress.stats.total_scraped++;
      if (!progress.completed[domain]) progress.completed[domain] = [];
      progress.completed[domain]!.push(url);
    } else {
      failed++;
      progress.stats.total_failed++;
      failedUrls.push(url);
    }

    // Progress logging every 10 URLs
    if ((i + 1) % 10 === 0 || i === pendingUrls.length - 1) {
      const pct = Math.round(((i + 1) / pendingUrls.length) * 100);
      const qualLabel = result.success ? result.quality : "FAIL";
      console.log(`    [${domain}] ${i + 1}/${pendingUrls.length} (${pct}%) | last: ${qualLabel} | fields: ${result.fieldsFound}`);
      saveProgress(progressFile, progress);
    }
  }

  // Retry failed URLs once
  if (failedUrls.length > 0) {
    console.log(`  [${domain}] Retrying ${failedUrls.length} failed URLs after cooldown...`);
    await new Promise((r) => setTimeout(r, RETRY_COOLDOWN_MS));

    for (const url of failedUrls) {
      await jitteredDelay();
      const retry = await scrapeOne(url, noAi);
      if (retry.success) {
        scraped++;
        failed--;
        progress.stats.total_scraped++;
        progress.stats.total_failed--;
        if (!progress.completed[domain]) progress.completed[domain] = [];
        progress.completed[domain]!.push(url);
      } else {
        if (!progress.failed[domain]) progress.failed[domain] = [];
        progress.failed[domain]!.push(url);
      }
    }
    saveProgress(progressFile, progress);
  }

  return { scraped, failed, skipped };
}

// ── Round-robin: one URL per vendor per round (long cooldown per vendor) ──────
async function runRoundRobin(
  vendorDomains: string[],
  vendorData: Record<string, { discovered: number; urls: string[] }>,
  progress: ProgressData,
  progressFile: string,
  noAi: boolean
): Promise<Record<string, { scraped: number; failed: number; skipped: number }>> {
  const results: Record<string, { scraped: number; failed: number; skipped: number }> = {};
  const completedSets: Record<string, Set<string>> = {};
  const nextIndex: Record<string, number> = {};
  const failedUrlsByVendor: Record<string, string[]> = {};
  /** Failed URLs from previous run: drain these first so we retry them on resume */
  const failedToRetry: Record<string, string[]> = {};

  for (const domain of vendorDomains) {
    results[domain] = { scraped: 0, failed: 0, skipped: 0 };
    completedSets[domain] = new Set(progress.completed[domain] ?? []);
    nextIndex[domain] = progress.nextIndex?.[domain] ?? 0;
    failedUrlsByVendor[domain] = [];
    failedToRetry[domain] = [...(progress.failed[domain] ?? [])];
  }

  const totalUrls = vendorDomains.reduce(
    (sum, d) => sum + (vendorData[d]?.urls?.length ?? 0) - completedSets[d]!.size,
    0
  );
  let totalProcessed = 0;   // scrapes only (success or fail)
  let totalDone = 0;        // scrapes + cache hits (for %)
  const logInterval = 50;

  /** Returns next URL to process: failed-from-previous-run first, then unprocessed from main list. */
  function getNextUrl(domain: string): { url: string; fromFailed: boolean } | null {
    const urls = vendorData[domain]?.urls ?? [];
    const completed = completedSets[domain]!;
    const failedQueue = failedToRetry[domain]!;
    if (failedQueue.length > 0) {
      const url = failedQueue.shift()!;
      return { url, fromFailed: true };
    }
    while (nextIndex[domain]! < urls.length) {
      const url = urls[nextIndex[domain]!++]!;
      if (!completed.has(url)) return { url, fromFailed: false };
    }
    return null;
  }

  const parallelPerRound = Math.min(MAX_PARALLEL_VENDORS, vendorDomains.length);
  console.log(
    "\n🔄 Round-robin mode: 1 URL per vendor per round, " +
      parallelPerRound +
      " vendors in parallel (~" +
      Math.ceil(vendorDomains.length / parallelPerRound) * (DELAY_BASE_MS / 1000) +
      "s per round)\n"
  );

  for (;;) {
    const roundWork: { domain: string; url: string; fromFailed: boolean }[] = [];
    for (const domain of vendorDomains) {
      const next = getNextUrl(domain);
      if (next) roundWork.push({ domain, ...next });
    }
    if (roundWork.length === 0) break;

    for (let i = 0; i < roundWork.length; i += MAX_PARALLEL_VENDORS) {
      const batch = roundWork.slice(i, i + MAX_PARALLEL_VENDORS);

      const cacheResults = await Promise.all(
        batch.map(async (item) => ({
          ...item,
          cached: await isAlreadyCached(item.url),
        }))
      );

      for (const { domain, url, fromFailed, cached } of cacheResults) {
        if (cached) {
          if (!progress.completed[domain]) progress.completed[domain] = [];
          progress.completed[domain]!.push(url);
          completedSets[domain]!.add(url);
          if (fromFailed && progress.failed[domain]) {
            progress.failed[domain] = progress.failed[domain]!.filter((u) => u !== url);
          }
          progress.stats.total_cached++;
          results[domain]!.skipped++;
          totalDone++;
        }
      }

      const toScrape = cacheResults.filter((r) => !r.cached);
      if (toScrape.length > 0) {
        const scrapeResults = await Promise.all(toScrape.map((item) => scrapeOne(item.url, noAi)));
        for (let j = 0; j < toScrape.length; j++) {
          const { domain, url, fromFailed } = toScrape[j]!;
          const result = scrapeResults[j]!;
          if (result.success) {
            if (!progress.completed[domain]) progress.completed[domain] = [];
            progress.completed[domain]!.push(url);
            completedSets[domain]!.add(url);
            if (fromFailed && progress.failed[domain]) {
              progress.failed[domain] = progress.failed[domain]!.filter((u) => u !== url);
            }
            progress.stats.total_scraped++;
            results[domain]!.scraped++;
          } else {
            progress.stats.total_failed++;
            results[domain]!.failed++;
            if (fromFailed) {
              if (!progress.failed[domain]) progress.failed[domain] = [];
              if (!progress.failed[domain]!.includes(url)) progress.failed[domain]!.push(url);
            } else {
              failedUrlsByVendor[domain]!.push(url);
            }
          }
          totalProcessed++;
          totalDone++;
        }
        const prevProcessed = totalProcessed - toScrape.length;
        if (Math.floor(totalProcessed / logInterval) > Math.floor(prevProcessed / logInterval)) {
          const pct = Math.round((totalDone / totalUrls) * 100);
          const totalScrapedSoFar = vendorDomains.reduce((s, d) => s + results[d]!.scraped, 0);
          const totalFailedSoFar = vendorDomains.reduce((s, d) => s + results[d]!.failed, 0);
          const totalSkippedSoFar = vendorDomains.reduce((s, d) => s + results[d]!.skipped, 0);
          console.log(
            `  [round-robin] ${totalDone}/${totalUrls} (${pct}%) | success: ${totalScrapedSoFar} | failed: ${totalFailedSoFar} | skipped: ${totalSkippedSoFar}`
          );
        }
      }

      await jitteredDelay();
    }

    progress.nextIndex = { ...nextIndex };
    saveProgress(progressFile, progress);
  }

  progress.nextIndex = nextIndex;
  saveProgress(progressFile, progress);

  // Retry failed URLs once (all vendors)
  const allFailed: { domain: string; url: string }[] = [];
  for (const domain of vendorDomains) {
    for (const url of failedUrlsByVendor[domain]!) allFailed.push({ domain, url });
  }
  if (allFailed.length > 0) {
    console.log(`\n  [round-robin] Retrying ${allFailed.length} failed URLs after 30s cooldown...`);
    await new Promise((r) => setTimeout(r, RETRY_COOLDOWN_MS));
    for (let i = 0; i < allFailed.length; i += MAX_PARALLEL_VENDORS) {
      const batch = allFailed.slice(i, i + MAX_PARALLEL_VENDORS);
      const retryResults = await Promise.all(batch.map(({ url }) => scrapeOne(url, noAi)));
      for (let j = 0; j < batch.length; j++) {
        const { domain, url } = batch[j]!;
        const retry = retryResults[j]!;
        if (retry.success) {
          if (!progress.completed[domain]) progress.completed[domain] = [];
          progress.completed[domain]!.push(url);
          progress.stats.total_scraped++;
          progress.stats.total_failed--;
          results[domain]!.scraped++;
          results[domain]!.failed--;
        } else {
          if (!progress.failed[domain]) progress.failed[domain] = [];
          progress.failed[domain]!.push(url);
        }
      }
      await jitteredDelay();
    }
    saveProgress(progressFile, progress);
  }

  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // Validate env
  if (!SUPABASE_URL) {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL not set.");
    process.exit(1);
  }
  if (!SERVICE_ROLE_KEY) {
    console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY not set.");
    process.exit(1);
  }

  // Parse CLI args (default: round-robin, no AI pass; use --ai to enable Tavily fallback)
  const args = process.argv.slice(2);
  const noAi = !args.includes("--ai");
  const forceParallel = args.includes("--parallel");
  const roundRobin = args.includes("--round-robin") || !forceParallel;
  const vendorFlag = args.indexOf("--vendor");
  const targetVendor = vendorFlag >= 0 ? args[vendorFlag + 1] : undefined;

  // Load discovered URLs
  const dataDir = path.join(__dirname, "..", "data");
  const urlsFile = path.join(dataDir, "vendor-urls.json");
  if (!fs.existsSync(urlsFile)) {
    console.error(`ERROR: ${urlsFile} not found. Run discover-urls.ts first.`);
    process.exit(1);
  }

  const vendorData: Record<string, { discovered: number; urls: string[] }> = JSON.parse(
    fs.readFileSync(urlsFile, "utf-8")
  );

  // Filter vendors if --vendor flag
  const vendorDomains = Object.keys(vendorData).filter((d) => {
    if (targetVendor) return d.includes(targetVendor);
    return true;
  });

  if (vendorDomains.length === 0) {
    console.error(`No vendors matching "${targetVendor}".`);
    process.exit(1);
  }

  const totalUrls = vendorDomains.reduce((sum, d) => sum + (vendorData[d]?.urls?.length ?? 0), 0);

  console.log(`\n🚀 Bulk Scrape Pipeline`);
  console.log(`   Vendors: ${vendorDomains.length}`);
  console.log(`   Total URLs: ${totalUrls}`);
  console.log(`   AI fallback: ${noAi ? "DISABLED (default; use --ai to enable)" : "ENABLED (--ai)"}`);
  console.log(
    `   Mode: ${roundRobin ? `ROUND-ROBIN (1 URL per vendor per round, up to ${MAX_PARALLEL_VENDORS} in parallel)` : `Parallel (${MAX_PARALLEL_VENDORS} vendors, full queue each)`}`
  );
  console.log(`   Delay: ${DELAY_BASE_MS}-${DELAY_BASE_MS + DELAY_JITTER_MS}ms (jittered)`);
  console.log(`   Scraper: ${BASE_URL}${API_PATH}`);
  console.log(`   Target DB: ${SUPABASE_URL}`);
  console.log();

  // Load / initialize progress
  const progressFile = path.join(dataDir, "scrape-progress.json");
  const progress = loadProgress(progressFile);

  let results: Record<string, { scraped: number; failed: number; skipped: number }>;

  if (roundRobin) {
    results = await runRoundRobin(vendorDomains, vendorData, progress, progressFile, noAi);
  } else {
    results = {};
    // Process vendors in parallel batches
    for (let i = 0; i < vendorDomains.length; i += MAX_PARALLEL_VENDORS) {
      const batch = vendorDomains.slice(i, i + MAX_PARALLEL_VENDORS);
      console.log(`\n── Batch ${Math.floor(i / MAX_PARALLEL_VENDORS) + 1}: ${batch.join(", ")} ──`);

      const promises = batch.map(async (domain) => {
        const urls = vendorData[domain]?.urls ?? [];
        if (urls.length === 0) {
          results[domain] = { scraped: 0, failed: 0, skipped: 0 };
          return;
        }
        results[domain] = await processVendor(domain, urls, progress, progressFile, noAi);
      });

      await Promise.all(promises);
    }
  }

  // Final save
  saveProgress(progressFile, progress);

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("BULK SCRAPE SUMMARY");
  console.log("=".repeat(70));
  console.log(`${"Vendor".padEnd(35)} ${"Scraped".padStart(8)} ${"Failed".padStart(8)} ${"Skipped".padStart(8)}`);
  console.log("-".repeat(63));

  let totalScraped = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const domain of vendorDomains) {
    const r = results[domain] ?? { scraped: 0, failed: 0, skipped: 0 };
    totalScraped += r.scraped;
    totalFailed += r.failed;
    totalSkipped += r.skipped;
    console.log(
      `${domain.padEnd(35)} ${String(r.scraped).padStart(8)} ${String(r.failed).padStart(8)} ${String(r.skipped).padStart(8)}`
    );
  }
  console.log("-".repeat(63));
  console.log(`${"TOTAL".padEnd(35)} ${String(totalScraped).padStart(8)} ${String(totalFailed).padStart(8)} ${String(totalSkipped).padStart(8)}`);
  console.log(`\n  Success: ${totalScraped}  |  Failed: ${totalFailed}  |  Skipped (cached): ${totalSkipped}`);
  console.log(`\nProgress saved to: ${progressFile}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
