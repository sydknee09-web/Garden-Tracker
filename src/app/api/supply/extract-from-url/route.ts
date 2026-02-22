import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const maxDuration = 30;

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

Use empty string for any field you cannot find. Return only valid JSON.`;

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

  return {
    name: getStr("name") || getStr("ogTitle") || "Imported product",
    brand: getStr("brand"),
    category: validCategory,
    npk: getStr("npk"),
    application_rate: getStr("application_rate"),
    usage_instructions: getStr("usage_instructions"),
    source_url: getStr("source_url") || url,
    image_url: getStr("image_url") || undefined,
  };
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
    });

  return error ? null : path;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "url required and must be http(s)" }, { status: 400 });
    }
    if (isUrlBlockedForSSRF(url)) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
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
      return NextResponse.json({ error: "Could not extract data from link" }, { status: 422 });
    }

    const result = parseExtractJson(text, url);
    if (!result) {
      return NextResponse.json({ error: "Could not parse extracted data" }, { status: 422 });
    }

    if (result.image_url) {
      const path = await fetchAndUploadImage(result.image_url, user.id);
      if (path) {
        (result as SupplyExtractResult).primary_image_path = path;
      }
    }
    delete (result as Record<string, unknown>).image_url;

    return NextResponse.json(result);
  } catch (e) {
    console.error("[supply/extract-from-url]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
