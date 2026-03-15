import { NextResponse } from "next/server";
import { getSupabaseUser, unauthorized } from "@/app/api/import/auth";
import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, DEFAULT_RATE_LIMIT } from "@/lib/rateLimit";
import { checkContentLength, MAX_URL_LENGTH } from "@/lib/requestValidation";
import { logRequestMetrics } from "@/lib/logRequestMetrics";

export const maxDuration = 30;

const ROUTE_ID = "supply-extract-from-url";

const SUPPLY_EXTRACT_PROMPT = `You are a garden supply inventory expert. Using Google Search Grounding, visit the given URL (a garden product page: fertilizer, pesticide, soil amendment, etc.) and extract information.

Return a single JSON object only (no markdown, no explanation). Use these exact keys:
- name: string (product name, e.g. "Fish Emulsion 5-1-1", "Neem Oil")
- brand: string (manufacturer or brand, e.g. "Neptune's Harvest", "Bonide")
- category: string (one of: "fertilizer", "pesticide", "soil_amendment", "other")
- npk: string (N-P-K ratio if found, e.g. "5-1-1", "10-10-10", "0-0-0")
- application_rate: string (how much to use, e.g. "1 tbsp per gallon", "2 oz per 1000 sq ft")
- usage_instructions: string (how to apply, when to use, safety notes - can be multiple sentences)
- source_url: string (the product page URL you used)
- image_url: string (direct https URL to the product image from the page, or empty string if none)
- size: string (numeric value only for package size, e.g. "50", "2.5", "1" - no unit)
- size_uom: string (unit of measure for package size only; normalize to: "lbs" for pounds/lb, "gal" for gallons/gallon/g, "oz" for ounces, "qt" for quarts, "pt" for pints, "ml" for milliliters, "L" for liters; use empty string if not found)

Normalize units: map "pounds" or "lb" to "lbs"; map "gallons" or "gallon" or "g" (when meaning gallon) to "gal"; "ounces" or "oz" to "oz". Use empty string for any field you cannot find. Return only valid JSON.`;

export type SupplyExtractResult = {
  name: string;
  brand: string;
  category: string;
  npk: string;
  application_rate: string;
  usage_instructions: string;
  source_url: string;
  image_url?: string;
  primary_image_path?: string;
  size?: string;
  size_uom?: string;
};

function parseExtractJson(jsonStr: string, url: string): SupplyExtractResult | null {
  let parsed: Record<string, unknown>;
  try {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (!match) return null;
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const getStr = (k: string) => (typeof parsed[k] === "string" ? String(parsed[k]).trim() : "");
  const cat = getStr("category").toLowerCase();
  const validCategory = ["fertilizer", "pesticide", "soil_amendment", "other"].includes(cat)
    ? cat
    : "other";

  const rawUom = getStr("size_uom").toLowerCase().replace(/\s+/g, "");
  const sizeUom = normalizeSizeUom(rawUom);

  return {
    name: getStr("name") || getStr("ogTitle") || "Imported product",
    brand: getStr("brand"),
    category: validCategory,
    npk: getStr("npk"),
    application_rate: getStr("application_rate"),
    usage_instructions: getStr("usage_instructions"),
    source_url: getStr("source_url") || url,
    image_url: getStr("image_url") || undefined,
    size: getStr("size") || undefined,
    size_uom: sizeUom || undefined,
  };
}

function normalizeSizeUom(raw: string): string {
  if (!raw) return "";
  const m: Record<string, string> = {
    lb: "lbs",
    lbs: "lbs",
    pound: "lbs",
    pounds: "lbs",
    gallon: "gal",
    gallons: "gal",
    gal: "gal",
    g: "gal",
    oz: "oz",
    ounce: "oz",
    ounces: "oz",
    qt: "qt",
    quart: "qt",
    quarts: "qt",
    pt: "pt",
    pint: "pt",
    pints: "pt",
    ml: "ml",
    l: "L",
    liter: "L",
    liters: "L",
  };
  return m[raw] ?? raw;
}

const IMAGE_FETCH_TIMEOUT_MS = 12_000;

/** Reject URLs that could target internal/private resources (SSRF). */
function isUrlBlockedForSSRF(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "0.0.0.0") return true;
    if (host.startsWith("127.")) return true;
    if (host === "::1" || host === "[::1]") return true;
    if (host.startsWith("10.")) return true;
    if (host.startsWith("192.168.")) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])(\.|$)/.test(host)) return true;
    if (host.startsWith("169.254.")) return true;
    return false;
  } catch {
    return true;
  }
}

async function fetchAndUploadImage(
  imageUrl: string,
  userId: string
): Promise<string | null> {
  if (!imageUrl?.startsWith("http")) return null;
  if (isUrlBlockedForSSRF(imageUrl)) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GardenTracker/1.0)",
      },
    });
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
  clearTimeout(timeoutId);

  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "";
  const rawType = contentType.split(";")[0].trim().toLowerCase();
  const isImage = rawType.startsWith("image/");
  if (!isImage) return null;

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sharp = (await import("sharp")).default;
  const compressed = await sharp(buffer)
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const path = `${userId}/supply-from-web-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const { error } = await admin.storage
    .from("journal-photos")
    .upload(path, compressed, {
      contentType: "image/jpeg",
      upsert: false,
      cacheControl: "31536000",
    });

  return error ? null : path;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  let statusCode = 500;
  try {
    const auth = await getSupabaseUser(req);
    if (!auth) {
      const res = unauthorized();
      statusCode = res.status;
      return res;
    }
    if (!checkRateLimit(auth.user.id, DEFAULT_RATE_LIMIT)) {
      statusCode = 429;
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }
    const { user } = auth;

    const bodySizeErr = checkContentLength(req);
    if (bodySizeErr) {
      statusCode = 400;
      return NextResponse.json(bodySizeErr, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url || !url.startsWith("http")) {
      statusCode = 400;
      return NextResponse.json({ error: "url required and must be http(s)" }, { status: 400 });
    }
    if (url.length > MAX_URL_LENGTH) {
      statusCode = 400;
      return NextResponse.json({ error: "URL too long" }, { status: 400 });
    }
    if (isUrlBlockedForSSRF(url)) {
      statusCode = 400;
      return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      statusCode = 503;
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${SUPPLY_EXTRACT_PROMPT}\n\nURL to analyze: ${url}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = response?.text?.trim();
    if (!text) {
      statusCode = 422;
      return NextResponse.json({ error: "Could not extract data from link" }, { status: 422 });
    }

    const result = parseExtractJson(text, url);
    if (!result) {
      statusCode = 422;
      return NextResponse.json({ error: "Could not parse extracted data" }, { status: 422 });
    }

    if (result.image_url) {
      const path = await fetchAndUploadImage(result.image_url, user.id);
      if (path) {
        (result as SupplyExtractResult).primary_image_path = path;
      }
    }
    delete (result as Record<string, unknown>).image_url;

    const { logApiUsageAsync } = await import("@/lib/logApiUsage");
    logApiUsageAsync({ userId: user.id, provider: "gemini", operation: "supply-extract-from-url" });

    statusCode = 200;
    return NextResponse.json(result);
  } catch (e) {
    console.error("[supply/extract-from-url]", e);
    statusCode = 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extraction failed" },
      { status: 500 }
    );
  } finally {
    logRequestMetrics(ROUTE_ID, Date.now() - startTime, statusCode);
  }
}
