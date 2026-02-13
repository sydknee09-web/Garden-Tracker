import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import {
  stripVarietySuffixes,
  stripPlantFromVariety,
  cleanVarietyForDisplay,
} from "@/lib/varietyNormalize";

export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** If request has Bearer token, return user id and a Set of blocked tag names (normalized). Otherwise null. */
export async function getBlockedTagsForRequest(req: Request): Promise<Set<string> | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.id) return null;
  const { data: rows } = await supabase.from("blocked_tags").select("tag_name").eq("user_id", user.id);
  const set = new Set<string>();
  (rows ?? []).forEach((r: { tag_name: string }) => set.add(String(r.tag_name).trim()));
  return set;
}

export function filterBlockedTags(tags: string[], blocked: Set<string> | null): string[] {
  if (!blocked?.size) return tags;
  return tags.filter((t) => {
    const s = String(t).trim();
    return s && !blocked.has(s);
  });
}

/** Vendor map: normalize domain to canonical name for canonical key merging (Rareseeds.com, Hudson Valley -> "Hudson Valley Seed Co"). */
const VENDOR_NORMALIZE_MAP: { pattern: RegExp; vendor: string }[] = [
  { pattern: /rareseeds\.com/i, vendor: "Rare Seeds" },
  { pattern: /hudsonvalleyseed/i, vendor: "Hudson Valley Seed Co" },
  { pattern: /floretflowers\.com/i, vendor: "Floret" },
];

/** Extract vendor hint from URL hostname (e.g. growitalian.com -> Growitalian). Uses VENDOR_NORMALIZE_MAP so rareseeds.com -> "Rare Seeds". */
export function vendorFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    for (const { pattern, vendor } of VENDOR_NORMALIZE_MAP) {
      if (pattern.test(host)) return vendor;
    }
    const name = host.split(".")[0] ?? host;
    return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "";
  }
}

/** Extract product/variety slug from path (e.g. /products/clemson-spineless-okra -> Clemson Spineless Okra). */
export function varietySlugFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match =
      pathname.match(/\/(?:products?|seeds)\/([^/?#]+)/i) ||
      pathname.match(/\/([^/?#]+)(?=[/?#]|$)/);
    const raw = (match?.[1] ?? "").trim();
    if (!raw) return "";
    return raw
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  } catch {
    return "";
  }
}

// Re-export for backward compatibility (canonical implementation in @/lib/varietyNormalize)
export { stripPlantFromVariety } from "@/lib/varietyNormalize";

/** Outside Pride: extract plant/category from URL slug (e.g. /fruit-seed/ -> "Fruit", /flower-seeds/ -> "Flower"). */
export function plantFromUrlSlug(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split("/").filter(Boolean)[0] ?? "";
    const withoutSeed = segment.replace(/-seeds?$/i, "").replace(/-seed$/i, "");
    if (!withoutSeed) return "";
    return withoutSeed
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  } catch {
    return "";
  }
}

/** Extract plant from the path segment immediately preceding the product slug (e.g. .../plectranthus/plectranthus-silver-crest.html -> "Plectranthus"). For Outside Pride & San Diego Seed Co. */
export function plantFromSegmentBeforeProduct(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length < 2) return "";
    const segmentBeforeProduct = segments[segments.length - 2] ?? "";
    const raw = segmentBeforeProduct.replace(/\.[^.]*$/, "").trim();
    if (!raw) return "";
    return raw
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  } catch {
    return "";
  }
}

/** Single-word or known category/color segment names that are too generic to use as plant type; prefer product slug when segment is one of these. */
const GENERIC_SEGMENT_NAMES = new Set([
  "silver", "gold", "red", "white", "blue", "green", "yellow", "pink", "orange", "purple", "black",
  "ornamental", "flower", "flowers", "foliage", "vegetable", "vegetables", "fruit", "herb", "herbs",
  "annual", "perennial", "organic", "heirloom", "mix", "mixed",
]);

/** True when the segment-before-product is a generic category/color (e.g. "Silver") so we should prefer plant from product slug. */
export function isGenericSegmentForPlant(segment: string): boolean {
  const s = (segment ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return true;
  return GENERIC_SEGMENT_NAMES.has(s);
}

/** Extract plant from the first part of the product slug (last path segment). e.g. plectranthus-silver-crest -> "Plectranthus". Use when segment-before-product is generic so type stays plant-only and variety can be "Silver Crest". */
export function plantFromProductSlug(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    const raw = last.replace(/\.[^.]*$/, "").trim();
    if (!raw || raw.length < 2) return "";
    const firstPart = raw.split("-")[0] ?? "";
    if (!firstPart) return "";
    return firstPart.replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  } catch {
    return "";
  }
}

export type ExtractResponse = {
  vendor: string;
  type: string;
  variety: string;
  tags: string[];
  confidence_score?: number;
  /** Scientific name (e.g. Thunbergia alata) when extractable from page or search */
  scientific_name?: string;
  /** Short plant description from scrape or research (passed to profile and cache) */
  plant_description?: string;
  /** Step 2 research (grounding) - optional */
  sowing_depth?: string;
  spacing?: string;
  sun_requirement?: string;
  days_to_germination?: string;
  days_to_maturity?: string;
  source_url?: string;
  /** From link extraction: high-quality plant/product image URL for profile hero */
  hero_image_url?: string;
  /** From photo extraction research: stock image of actual plant/fruit (not packet) for profile hero */
  stock_photo_url?: string;
};

const SYSTEM_PROMPT = `You are a botanical inventory expert. Look at the seed packet image and extract text you can clearly see.

Return a JSON array with one object. Schema: [{ "vendor": string, "plant_type": string, "variety": string, "tags": string[], "confidence_score": number }]

Rules:
- plant_type: Use the main crop name visible on the packet (e.g. if you see "SUNFLOWER" or "Sunflower", use "Sunflower"; if you see "TOMATO", use "Tomato"). Normalize to a single common name (e.g. "Beet" not "Garden Beet seeds"). This field is required when any crop name is visible.
- variety: The specific variety or cultivar name if shown (e.g. "Mammoth", "Bulls Blood", "Roma"). Leave empty string only if no variety is visible.
- vendor: The brand or company name (e.g. "Baker Creek", "Burpee") if visible. Leave empty string if not visible.
- tags: Return a JSON array of attribute labels found on the packet. Include any of: "F1", "Organic", "Heirloom", "Open Pollinated", "Non-GMO", "Hybrid", "Hybrid F1". Strip these from the variety name. Use [] if none. Example: ["Heirloom", "Non-GMO", "Open Pollinated"].
- confidence_score: A number 0-1 for how confident you are in the extraction.

Use only text you actually see on the packet. Do not return filenames or numerical IDs. Use empty string for a field only when that information is truly not visible.`;

const RESEARCH_PROMPT = `Using Google Search Grounding, find the official product page or a reliable gardening guide for this specific seed variety.

Also: find a high-quality stock image URL or product photo that represents the Actual Plant or Fruit (not the seed packet) for this variety. Prefer a clear photo of the mature plant, flower, or harvest.

Extract the following and return a single JSON object only (no markdown, no explanation):
- sowing_depth: e.g. "0.25 inches" or "1/4 inch"
- spacing: e.g. "12-18 inches" or "2 feet"
- sun_requirement: e.g. "Full Sun", "Partial Shade", "Full Sun to Partial Shade"
- days_to_germination: e.g. "7-14" or "10"
- days_to_maturity: e.g. "65" or "55-70"
- source_url: the URL of the page you used (so the user can verify)
- stock_photo_url: a direct URL (https://...) to a high-quality stock image of the actual plant/fruit for this variety—not the packet. Use empty string if no suitable image found.

Use standard units: inches for depth and spacing, days for germination and maturity. Use empty string for any field you cannot find. Return only valid JSON.`;

const LINK_EXTRACT_PROMPT = `You are a botanical inventory expert. Using Google Search Grounding, visit the given URL (a seed or plant product page) and extract information.

VENDOR BLOCKERS: Some sites (e.g. highmowingseeds.com, sandiegoseedcompany.com) use bot protection and may block or limit live scraping. If you cannot read the page content, rely on your internal knowledge of that seed company and the URL/product context: infer vendor, plant_type, and variety from the URL slug, domain, and your knowledge of their catalog. Fill in as much as you can; use empty string only when you truly do not know.

REQUIRED when the page is readable: Use Google Search to find and return a stock photo of the actual plant, flower, or fruit for this variety—not a logo, not a packet. If the live page is blocked, you may omit image URLs and the user will add one later.

Return a single JSON object only (no markdown, no explanation). Use these exact keys:
- vendor: string (brand or company name, e.g. "Baker Creek", "Burpee")
- plant_type: string (main crop name, e.g. "Tomato", "Sunflower", "Lettuce")
- variety: string (specific variety/cultivar name if shown, else empty string)
- scientific_name: string (Latin/scientific name when known, e.g. "Thunbergia alata", "Beta vulgaris"). Leave empty string if not found.
- tags: array of strings from the page, e.g. ["Heirloom", "Organic", "Non-GMO", "Open Pollinated", "F1", "Hybrid"]
- sowing_depth: string (e.g. "0.25 inches" or "1/4 inch")
- spacing: string (e.g. "12-18 inches" or "2 feet")
- sun_requirement: string (e.g. "Full Sun", "Partial Shade")
- days_to_germination: string (e.g. "7-14" or "10")
- days_to_maturity: string (e.g. "65" or "55-70")
- source_url: the URL you used (the given URL or the canonical product page)
- stock_photo_url: direct URL (https://) to a high-quality stock image of the actual plant, flower, or fruit for this variety. Use empty string if the page is blocked or no suitable image found.
- hero_image_url: same as stock_photo_url (use the same URL for profile hero).

Use empty string for any field you cannot find. Return only valid JSON.`;

/** Safe string from parsed JSON: missing or non-string becomes "". */
function safeStr(parsed: Record<string, unknown>, key: string): string {
  const v = parsed[key];
  return typeof v === "string" ? String(v).trim() : "";
}

/** Common specific flower/ornamental names used when vendor returns broad "Flower" so we can set Type and de-dupe variety. */
const SPECIFIC_FLOWER_PLANT_NAMES = [
  "celosia", "zinnia", "marigold", "cosmos", "snapdragon", "petunia", "dahlia", "nasturtium",
  "sunflower", "pansy", "viola", "calendula", "ageratum", "coleus", "impatiens", "salvia",
  "verbena", "lisianthus", "stock", "sweet pea", "sweetpea", "aster", "phlox", "rudbeckia",
  "echinacea", "coreopsis", "gaillardia", "dianthus", "geranium", "pelargonium", "begonia",
];

/**
 * When plant type is generic (e.g. "Flower", "Flower Seed"), infer a specific type from the variety name.
 * 1) Try known flower names (SPECIFIC_FLOWER_PLANT_NAMES) for normalization (e.g. "Sweet Pea").
 * 2) If no match, use the first word of the variety as the plant name so we don't need a fixed list (e.g. "Plectranthus Silver Crest" → "Plectranthus").
 * Returns the specific plant name with normal casing, or null if none found.
 */
export function inferSpecificPlantFromVariety(variety: string): string | null {
  const v = (variety ?? "").trim();
  if (!v) return null;
  const vLower = v.toLowerCase();
  for (const name of SPECIFIC_FLOWER_PLANT_NAMES) {
    const re = new RegExp("\\b" + name.replace(/\s+/g, "\\s+") + "\\b", "i");
    if (re.test(v)) {
      if (name === "sweet pea" || name === "sweetpea") return "Sweet Pea";
      return name.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  const firstWord = v.split(/\s+/)[0]?.trim() ?? "";
  if (firstWord.length >= 2 && /^[a-zA-Z]+$/.test(firstWord)) {
    return firstWord.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

// Re-export for backward compatibility (canonical implementation in @/lib/varietyNormalize)
export { stripVarietySuffixes, cleanVarietyForDisplay } from "@/lib/varietyNormalize";

/** Parse link-extract JSON robustly; missing fields become empty string so we never fail the whole object. */
function parseLinkExtractJson(jsonStr: string, url: string): ExtractResponse | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;

  let tags: string[] = [];
  if (Array.isArray(parsed.tags)) {
    tags = parsed.tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => String(t).trim())
      .filter(Boolean);
  }

  const vendor = decodeHtmlEntities(safeStr(parsed, "vendor")) || safeStr(parsed, "vendor");
  const typeRaw = safeStr(parsed, "plant_type") || safeStr(parsed, "type");
  const type = decodeHtmlEntities(typeRaw) || typeRaw || "Imported seed";
  const varietyRaw = safeStr(parsed, "variety");
  const variety = decodeHtmlEntities(varietyRaw) || varietyRaw;
  const scientific_name = safeStr(parsed, "scientific_name") || undefined;
  const stockPhotoUrl = safeStr(parsed, "stock_photo_url") || safeStr(parsed, "hero_image_url");

  return {
    vendor,
    type: type || "Imported seed",
    variety,
    scientific_name,
    tags,
    sowing_depth: safeStr(parsed, "sowing_depth") || undefined,
    spacing: safeStr(parsed, "spacing") || undefined,
    sun_requirement: safeStr(parsed, "sun_requirement") || undefined,
    days_to_germination: safeStr(parsed, "days_to_germination") || undefined,
    days_to_maturity: safeStr(parsed, "days_to_maturity") || undefined,
    source_url: safeStr(parsed, "source_url") || url,
    stock_photo_url: stockPhotoUrl || undefined,
    hero_image_url: stockPhotoUrl || undefined,
  };
}

const PASS_1_5_RESCUE_PROMPT = `I have a seed link that blocked scraping. Based on the variety name and vendor below, search the web and provide the standard seed/product details for this variety.

Return a single JSON object only (no markdown, no explanation). Use these exact keys:
- plant_type: string (main crop name, e.g. "Tomato", "Okra", "Lettuce")
- variety: string (the variety/cultivar name—use the name given below)
- scientific_name: string (Latin/scientific name if known, e.g. "Thunbergia alata". Empty string if not found.)
- vendor: string (the vendor/company name—use the name given below)
- days_to_maturity: string (e.g. "65" or "55-70")
- sowing_depth: string (e.g. "0.5 inches" or "1/2 inch")
- spacing: string (e.g. "12-18 inches" or "2 feet")
- sun_requirement: string (e.g. "Full Sun", "Partial Shade")
- days_to_germination: string (e.g. "7-14" or "10")
- tags: array of strings if known (e.g. ["Heirloom", "Open Pollinated"]), or []

Use empty string for any field you cannot find. Return only valid JSON.`;

const HERO_SEARCH_PROMPT = `Using Google Search Grounding, find a high-quality stock image URL of the actual plant, flower, or fruit (not a seed packet) for this variety.

Return a single JSON object only (no markdown, no explanation):
- hero_image_url: a direct URL (https://...) to a high-quality stock photo representing the plant/variety. Use empty string if none found.

Return only valid JSON.`;

/** Pass 2 (rescue): When direct scrape fails, rescue identity from URL slug + domain and enrich via AI search. */
export async function rescueFromUrl(apiKey: string, url: string): Promise<ExtractResponse | null> {
  const vendorHint = vendorFromUrl(url);
  const varietyHint = varietySlugFromUrl(url);
  if (!varietyHint && !vendorHint) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${PASS_1_5_RESCUE_PROMPT}\n\nVariety name (from URL): ${varietyHint || "unknown"}\nVendor (from domain): ${vendorHint || "unknown"}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const text = response?.text?.trim() ?? "";
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const getStr = (k: string) => (typeof parsed[k] === "string" ? String(parsed[k]).trim() : "");
    let tags: string[] = [];
    if (Array.isArray(parsed.tags)) {
      tags = parsed.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => String(t).trim())
        .filter(Boolean);
    }
    const typeRaw = getStr("plant_type") || getStr("type");
    const type = decodeHtmlEntities(typeRaw) || typeRaw || "Imported seed";
    // RareSeeds 403 recovery: use URL slug as variety so AI doesn't substitute a category or wrong name
    let variety = getStr("variety") || varietyHint;
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes("rareseeds") && varietyHint) variety = varietyHint;
    } catch {
      /* ignore */
    }
    variety = decodeHtmlEntities(variety) || variety;
    const vendor = decodeHtmlEntities(getStr("vendor") || vendorHint) || getStr("vendor") || vendorHint;
    return {
      vendor,
      type: type || "Imported seed",
      variety,
      scientific_name: getStr("scientific_name") || undefined,
      tags,
      sowing_depth: getStr("sowing_depth") || undefined,
      spacing: getStr("spacing") || undefined,
      sun_requirement: getStr("sun_requirement") || undefined,
      days_to_germination: getStr("days_to_germination") || undefined,
      days_to_maturity: getStr("days_to_maturity") || undefined,
      source_url: url,
    };
  } catch {
    return null;
  }
}

/** Pass 3: Search for hero image by variety + plant type. Returns URL or "". */
export async function findHeroPhotoForExtract(
  apiKey: string,
  plantType: string,
  variety: string,
  _vendor: string
): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const query = [variety, plantType, "plant"].filter(Boolean).join(" ") || (plantType || "plant") + " plant";
    const prompt = `${HERO_SEARCH_PROMPT}\n\nSearch for: ${query}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const text = response?.text?.trim() ?? "";
    if (!text) return "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return "";
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const url = typeof parsed.hero_image_url === "string" ? String(parsed.hero_image_url).trim() : "";
    return url || "";
  } catch {
    return "";
  }
}

export async function extractFromUrl(apiKey: string, url: string): Promise<ExtractResponse | null> {
  try {
    console.log("[extract] Link: Starting AI call (Gemini with Google Search) for URL:", url?.slice(0, 60) + "...");
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${LINK_EXTRACT_PROMPT}\n\nURL to analyze: ${url}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const text = response.text?.trim();
    console.log("[extract] Link: AI response received, parsing JSON");
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return parseLinkExtractJson(jsonMatch[0], url);
  } catch {
    return null;
  }
}

/** Name+variety research (no vendor in query for better results). Exported for enrich-from-name (store-bought). */
export async function researchVariety(
  apiKey: string,
  plantType: string,
  variety: string,
  vendor: string
): Promise<Partial<ExtractResponse> | null> {
  try {
    console.log("[extract] Research variety (Gemini + Search) for", plantType, variety || "(no variety)");
    const ai = new GoogleGenAI({ apiKey });
    const searchQuery =
      [vendor, plantType, variety].filter(Boolean).join(" ") || "seed planting guide";
    const prompt = `${RESEARCH_PROMPT}\n\nSearch for: ${searchQuery}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const text = response.text?.trim();
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const getStr = (k: string) =>
      typeof parsed[k] === "string" ? (parsed[k] as string).trim() : "";
    let source_url = getStr("source_url");
    if (!source_url && response.candidates?.[0]?.groundingMetadata?.groundingChunks?.length) {
      const firstWeb = response.candidates[0].groundingMetadata.groundingChunks.find(
        (c) => c.web?.uri
      );
      source_url = firstWeb?.web?.uri ?? "";
    }
    return {
      sowing_depth: getStr("sowing_depth") || undefined,
      spacing: getStr("spacing") || undefined,
      sun_requirement: getStr("sun_requirement") || undefined,
      days_to_germination: getStr("days_to_germination") || undefined,
      days_to_maturity: getStr("days_to_maturity") || undefined,
      source_url: source_url || undefined,
      stock_photo_url: getStr("stock_photo_url") || undefined,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";

    if (url) {
      console.log("[extract] URL branch: request received for", url?.slice(0, 60) + "...");
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
      if (!apiKey) {
        return NextResponse.json(
          { error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" },
          { status: 503 }
        );
      }
      const blocked = await getBlockedTagsForRequest(req);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (line: string) => controller.enqueue(encoder.encode(line + "\n"));
          try {
            send("phase:1:Scraping Link...");
            send("phase:2:Extracting Seed Data (AI)...");
            let result = await extractFromUrl(apiKey, url);
            if (!result) {
              send("phase:3:Rescuing Data via Search...");
              result = await rescueFromUrl(apiKey, url);
              if (!result) {
                send("error:Could not extract data from link");
                controller.close();
                return;
              }
            }
            result.tags = filterBlockedTags(result.tags ?? [], blocked);
            const hasImageFromPass1 = !!(result.hero_image_url?.trim() || result.stock_photo_url?.trim());
            if (!hasImageFromPass1) {
              send("phase:4:Finding Photo...");
              const pass2Url = await findHeroPhotoForExtract(
                apiKey,
                result.type || "Imported seed",
                result.variety ?? "",
                result.vendor ?? ""
              );
              if (pass2Url) {
                result.stock_photo_url = pass2Url;
                result.hero_image_url = pass2Url;
              }
            }
            send("result:" + JSON.stringify(result));
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Extraction failed";
            send("error:" + msg);
          }
          controller.close();
        },
      });
      return new NextResponse(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    console.log("[extract] Image path: Starting (photo extraction)");
    let imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64.trim() : "";
    if (!imageBase64) {
      return NextResponse.json(
        { error: "imageBase64 or url required" },
        { status: 400 }
      );
    }
    const mimeType = (body.mimeType as string) || "image/jpeg";
    if (imageBase64.includes(",")) {
      imageBase64 = imageBase64.split(",")[1] ?? imageBase64;
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" },
        { status: 503 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType.startsWith("image/") ? mimeType : "image/jpeg",
      },
    };

    console.log("[extract] Image path: Calling Gemini for packet text extraction (AI)");
    const maxAttempts = 2;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await model.generateContent([SYSTEM_PROMPT, imagePart]);
        const text = result.response.text();
        if (!text) {
          return NextResponse.json(
            { vendor: "", type: "", variety: "", tags: [] } satisfies ExtractResponse,
            { status: 200 }
          );
        }

        // Model returns a JSON array of objects; take first element for single-image input
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        let parsed: Record<string, unknown> = {};
        if (arrayMatch) {
          try {
            const arr = JSON.parse(arrayMatch[0]) as unknown[];
            const first = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
            parsed = first && typeof first === "object" && first !== null ? (first as Record<string, unknown>) : {};
          } catch {
            const objMatch = text.match(/\{[\s\S]*\}/);
            parsed = objMatch ? (JSON.parse(objMatch[0]) as Record<string, unknown>) : {};
          }
        } else {
          const objMatch = text.match(/\{[\s\S]*\}/);
          parsed = objMatch ? (JSON.parse(objMatch[0]) as Record<string, unknown>) : {};
        }

        const vendorRaw = typeof parsed.vendor === "string" ? parsed.vendor.trim() : "";
        const typeRaw = typeof parsed.plant_type === "string" ? parsed.plant_type.trim() : (typeof parsed.type === "string" ? parsed.type.trim() : "");
        const varietyRaw = typeof parsed.variety === "string" ? parsed.variety.trim() : "";
        const vendor = decodeHtmlEntities(vendorRaw) || vendorRaw;
        const type = decodeHtmlEntities(typeRaw) || typeRaw;
        const variety = decodeHtmlEntities(varietyRaw) || varietyRaw;
        let tags: string[] = [];
        if (Array.isArray(parsed.tags)) {
          tags = parsed.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim())
            .filter(Boolean);
        }
        const confidence_score = typeof parsed.confidence_score === "number" ? parsed.confidence_score : undefined;

        const blocked = await getBlockedTagsForRequest(req);
        let filteredTags = filterBlockedTags(tags ?? [], blocked);

        // Same normalization as link import: strip plant from variety, clean variety, merge F1/Heirloom into tags
        let varietyForResponse = (variety ?? "").trim();
        const typeForNorm = (type ?? "").trim() || "Imported seed";
        varietyForResponse = stripPlantFromVariety(varietyForResponse, typeForNorm);
        const { cleanedVariety, tagsToAdd } = cleanVarietyForDisplay(varietyForResponse, typeForNorm);
        varietyForResponse = cleanedVariety;
        const mergedTags = [...filteredTags];
        for (const t of tagsToAdd) {
          if (t && !mergedTags.some((x) => x.toLowerCase() === t.toLowerCase())) mergedTags.push(t);
        }

        const base: ExtractResponse = {
          vendor: vendor ?? "",
          type: typeForNorm || "Imported seed",
          variety: varietyForResponse ?? "",
          tags: mergedTags,
          ...(confidence_score !== undefined && { confidence_score }),
        };

        if (typeForNorm || varietyForResponse) {
          const research = await researchVariety(apiKey, typeForNorm, varietyForResponse, vendor);
          if (research) {
            Object.assign(base, research);
          }
        }

        return NextResponse.json(base);
      } catch (e) {
        lastError = e;
        const status = (e as { status?: number }).status;
        const is429 = status === 429;
        const canRetry = is429 && attempt < maxAttempts;
        if (canRetry) {
          const msg = e instanceof Error ? e.message : String(e);
          const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
          const delayMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) : 15000;
          await new Promise((r) => setTimeout(r, Math.min(delayMs, 20000)));
          continue;
        }
        throw e;
      }
    }
    throw lastError;
  } catch (e) {
    console.error("Seed extract route error:", e);
    const status = (e as { status?: number }).status;
    const message = e instanceof Error ? e.message : "Extraction failed";
    const isRateLimit = status === 429 || message.toLowerCase().includes("quota") || message.includes("429");
    const userMessage = isRateLimit
      ? "Gemini API rate limit exceeded. Please try again in a minute or check your quota at https://ai.google.dev/gemini-api/docs/rate-limits"
      : message.includes("API key") || message.includes("403") || message.includes("401")
        ? message
        : message.length < 120
          ? message
          : "Extraction failed";
    return NextResponse.json(
      { error: userMessage },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
