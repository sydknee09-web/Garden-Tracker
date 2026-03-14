import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getSupabaseUser, unauthorized } from "@/app/api/import/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logApiUsageAsync } from "@/lib/logApiUsage";
import { checkRateLimit, DEFAULT_RATE_LIMIT } from "@/lib/rateLimit";
import { checkContentLength } from "@/lib/requestValidation";

export const maxDuration = 30;

export type SupplyPhotoExtractResult = {
  name: string;
  brand: string;
  category: string;
  npk: string;
  application_rate: string;
  usage_instructions: string;
  source_url: string;
  primary_image_path?: string;
};

const SUPPLY_PHOTO_PROMPT = `You are a garden supply product expert. Look at this image of a fertilizer, pesticide, soil amendment, or other garden product (bottle, bag, or label).

Extract all visible information. Return ONLY valid JSON with these exact keys (use empty string if not found):
- name: Product name (e.g. "Fish Emulsion 5-1-1", "Neem Oil")
- brand: Manufacturer or brand (e.g. "Neptune's Harvest", "Bonide")
- category: One of "fertilizer", "pesticide", "soil_amendment", "other"
- npk: N-P-K ratio if visible (e.g. "5-1-1", "10-10-10")
- application_rate: Dosage/rate (e.g. "1 tbsp per gallon", "2 oz per 1000 sq ft")
- usage_instructions: How to use, when to apply, safety notes from the label
- source_url: Empty string (we don't have a URL from a photo)

Return ONLY the JSON object, no markdown or explanation.`;

/** Strip brand from start of product name when duplicated (e.g. "Monterey Fish Emulsion" → "Fish Emulsion"). */
function stripBrandFromName(name: string, brand: string): string {
  if (!brand?.trim()) return name.trim();
  const prefix = brand.trim();
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*${escaped}\\s+`, "i");
  const trimmed = name.trim().replace(re, "").trim();
  return trimmed || name.trim();
}

function parseExtractJson(jsonStr: string): SupplyPhotoExtractResult | null {
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
  const rawName = getStr("name") || "Imported product";
  const brand = getStr("brand");

  return {
    name: stripBrandFromName(rawName, brand),
    brand,
    category: validCategory,
    npk: getStr("npk"),
    application_rate: getStr("application_rate"),
    usage_instructions: getStr("usage_instructions"),
    source_url: getStr("source_url"),
  };
}

export async function POST(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    if (!auth) return unauthorized();
    if (!checkRateLimit(auth.user.id, DEFAULT_RATE_LIMIT)) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }
    const { user } = auth;
    const bodySizeErr = checkContentLength(req);
    if (bodySizeErr) return NextResponse.json(bodySizeErr, { status: 400 });
    const body = (await req.json()) as { imageBase64?: string; mimeType?: string };
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ??
      process.env.GEMINI_API_KEY?.trim() ??
      process.env.GOOGLE_AI_KEY?.trim() ??
      "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: SUPPLY_PHOTO_PROMPT },
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: imageBase64,
          },
        },
      ],
    });

    const text = result.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "Could not extract data from image" }, { status: 422 });
    }

    const parsed = parseExtractJson(text);
    if (!parsed) {
      return NextResponse.json({ error: "Could not parse extracted data" }, { status: 422 });
    }

    // Compress and upload the image to storage as the product photo
    const admin = getSupabaseAdmin();
    if (admin && user?.id) {
      try {
        const buffer = Buffer.from(imageBase64, "base64");
        const sharp = (await import("sharp")).default;
        const compressed = await sharp(buffer)
          .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        const path = `${user.id}/supply-from-photo-${crypto.randomUUID().slice(0, 8)}.jpg`;
        const { error } = await admin.storage
          .from("journal-photos")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
        if (!error) parsed.primary_image_path = path;
      } catch {
        // Non-fatal; continue without stored image
      }
    }

    logApiUsageAsync({ userId: user.id, provider: "gemini", operation: "supply-extract-from-photo" });

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[supply/extract-from-photo]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
