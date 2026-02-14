import type { SeedQRPrefill } from "./parseSeedFromQR";
import { getRareseedsSlugFromUrl, rareseedsAutotreatment, slugToSpaced } from "./rareseedsAutotreatment";
import { getVendorFromUrl } from "./vendorNormalize";

/**
 * 11 Functional Tags: scan URL slug and plant name for these keywords.
 * Slope Stabilizer (Ceanothus, Carex, Cistus), Groundcover (Kurapia, Dymondia), Low Chill (fruit trees < 400 hrs),
 * Edible Flower, Pollinator, Cutting Garden, Drought Tolerant, Heat Lover, Fruit Tree, Winter Sower, Zone 10a Optimized.
 */
const TAG_KEYWORDS: { pattern: RegExp | string; tag: string }[] = [
  { pattern: /slope\s*stabilizer|ceanothus|carex|cistus|erosion/i, tag: "Slope Stabilizer" },
  { pattern: /groundcover|ground\s*cover|kurapia|dymondia/i, tag: "Groundcover" },
  { pattern: /low\s*chill|chill\s*hours|<\s*400|under\s*400|less\s*than\s*400/i, tag: "Low Chill" },
  { pattern: /edible\s*flower|flowers\s*edible|edible\s*bloom/i, tag: "Edible Flower" },
  { pattern: /pollinator|bee\s*friendly|attract\s*pollinator/i, tag: "Pollinator" },
  { pattern: /cutting\s*garden|cut\s*flower/i, tag: "Cutting Garden" },
  { pattern: /drought\s*tolerant|drought\s*resistant|drought/i, tag: "Drought Tolerant" },
  { pattern: /heat\s*lover|heat\s*tolerant|heat\s*resistant/i, tag: "Heat Lover" },
  { pattern: /fruit\s*tree|tree\s*fruit/i, tag: "Fruit Tree" },
  { pattern: /winter\s*sow|winter\s*sowing|winter\s*sown/i, tag: "Winter Sower" },
  { pattern: /zone\s*10|10a|10b|zone\s*10a/i, tag: "Zone 10a Optimized" },
];

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|msclkid|ref)/i;

function cleanPath(pathname: string): string {
  let path = pathname
    .replace(/\/products\/?/gi, "/")
    .replace(/\.html$/i, "")
    .replace(/\/+/g, "/");
  if (path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

function slugToWords(slug: string): string[] {
  return decodeURIComponent(slug.replace(/-/g, " ")).trim().split(/\s+/).filter(Boolean);
}

/** PROPER-style: first letter of each word capitalized (e.g. "chocolate sunflower" → "Chocolate Sunflower") */
function toTitleCase(s: string): string {
  if (!s || !s.trim()) return s;
  return s.trim().replace(/(^|\s)(\w)/g, (_, before, letter) => before + letter.toUpperCase());
}

function extractTagsFromText(text: string): string[] {
  const tags: string[] = [];
  if (!text || !text.trim()) return tags;
  for (const { pattern, tag } of TAG_KEYWORDS) {
    const match = typeof pattern === "string" ? text.toLowerCase().includes(pattern) : pattern.test(text);
    if (match && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** Export for batch OCR: apply the 11 functional tags to any text (e.g. OCR result). */
export function getTagsFromText(text: string): string[] {
  return extractTagsFromText(text);
}

/** Scan URL slug and plant name/variety for the 11 functional tags; merge without duplicates. */
function extractAllTags(slugText: string, plantName?: string, variety?: string): string[] {
  const seen = new Set<string>();
  const add = (t: string) => { if (t && !seen.has(t)) seen.add(t); };
  extractTagsFromText(slugText).forEach(add);
  if (plantName) extractTagsFromText(plantName).forEach(add);
  if (variety) extractTagsFromText(variety).forEach(add);
  return Array.from(seen);
}

/** Google Favicon fallback when og:image cannot be scraped (CORS). Pass full URL. */
export function getImageFallbackUrl(url: string): string {
  try {
    const full = url.startsWith("http") ? url : "https://" + url;
    return `https://t1.gstatic.com/faviconV2?url=${encodeURIComponent(full)}&size=128`;
  } catch {
    return "";
  }
}

export interface SeedImportPrefill extends SeedQRPrefill {
  tags?: string[];
  /** Full URL to store in source_url for persistence */
  source_url?: string;
  /** Fallback image URL (e.g. Google Favicon) when og:image is blocked */
  image_fallback_url?: string;
  /** True when URL was imported but auto-details were unavailable (e.g. site security) */
  details_blocked?: boolean;
}

/**
 * Universal smart URL parser: vendor detection, clean path, name mapping, harvest_days from slug, 11 functional tags.
 * Always returns source_url when URL is valid. Does not throw; leaves fields blank if parsing fails (resilient to CORS / scrape blocks).
 */
/** When URL is rareseeds.com and knownPlantTypes is provided, parses slug as [Type]-[Variety]. */
export function parseSeedFromImportUrl(urlString: string, knownPlantTypes?: string[]): SeedImportPrefill {
  const trimmed = urlString.trim();
  if (!trimmed) return {};

  const out: SeedImportPrefill = {};

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : "https://" + trimmed);
    out.source_url = url.href;
    out.image_fallback_url = getImageFallbackUrl(url.href);

    out.vendor = getVendorFromUrl(url.href);

    const pathname = cleanPath(url.pathname);
    const pathParts = pathname.split("/").filter(Boolean);
    const combinedSlug = pathParts.join(" ");

    const isRareseeds = host === "rareseeds.com" || url.hostname.toLowerCase().includes("rareseeds.com");
    if (isRareseeds && knownPlantTypes && knownPlantTypes.length > 0) {
      const slug = getRareseedsSlugFromUrl(url.href);
      if (slug) {
        const result = rareseedsAutotreatment(slugToSpaced(slug), knownPlantTypes);
        out.name = result.plant_name;
        out.variety = result.variety_name?.trim() || undefined;
      }
    }

    if (pathParts.length >= 1 && (!out.name || !out.variety)) {
      const lastSlug = pathParts[pathParts.length - 1];
      const words = slugToWords(lastSlug).filter((w) => !/^\d+$/.test(w));
      if (words.length > 0) {
        const isMarys = out.vendor === "Mary's";
        if (isMarys) {
          if (!out.name) out.name = toTitleCase(words[words.length - 1]);
          if (words.length > 1 && !out.variety) out.variety = toTitleCase(words.slice(0, -1).join(" "));
        } else {
          if (!out.name) out.name = toTitleCase(words[0]);
          if (words.length > 1 && !out.variety) out.variety = toTitleCase(words.slice(1).join(" "));
        }
      }
      const daysMatch = lastSlug.match(/(\d{2,3})-?day/i) ?? pathname.match(/(\d{2,3})-?day/i);
      if (daysMatch) out.harvest_days = daysMatch[1];
    }

    if (pathParts.length >= 2 && !out.variety) {
      const varietySlug = pathParts[pathParts.length - 2];
      const varietyDecoded = decodeURIComponent(varietySlug.replace(/-/g, " "));
      if (varietyDecoded && !varietyDecoded.match(/^\d+$/)) {
        out.variety = toTitleCase(varietyDecoded);
      }
    }

    const p = url.searchParams;
    if (p.has("name") && p.get("name")) out.name = toTitleCase(p.get("name") ?? "");
    if (p.has("variety") && p.get("variety")) out.variety = toTitleCase(p.get("variety") ?? "");
    if (p.has("vendor") && p.get("vendor")) out.vendor = p.get("vendor") ?? undefined;
    if (p.has("harvest_days") && p.get("harvest_days")) out.harvest_days = p.get("harvest_days") ?? undefined;

    out.tags = extractAllTags(combinedSlug, out.name, out.variety);

    const hasUsefulDetails = !!(out.name || out.variety || out.harvest_days || (out.tags && out.tags.length > 0));
    if (out.source_url && !hasUsefulDetails) out.details_blocked = true;

    return out;
  } catch {
    return {};
  }
}
