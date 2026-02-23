import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logApiUsageAsync } from "@/lib/logApiUsage";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const maxDuration = 30;

const ENRICH_PROMPT = `You are a garden supply inventory expert. Using Google Search Grounding, search for the given garden product (fertilizer, pesticide, soil amendment, etc.) and extract product information.

Return a single JSON object only (no markdown, no explanation). Use these exact keys:
- name: string (product name)
- brand: string (manufacturer or brand)
- category: string (one of: "fertilizer", "pesticide", "soil_amendment", "other")
- npk: string (N-P-K ratio if found, e.g. "5-1-1", "10-10-10")
- application_rate: string (how much to use)
- usage_instructions: string (how to apply, when to use, safety notes)
- source_url: string (product page URL if found, or empty string)
- image_url: string (direct https URL to product image, or empty string)

Use empty string for any field you cannot find. Return only valid JSON.`;

function parseEnrichJson(jsonStr: string): Record<string, string> | null {
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
    name: getStr("name") || "",
    brand: getStr("brand"),
    category: validCategory,
    npk: getStr("npk"),
    application_rate: getStr("application_rate"),
    usage_instructions: getStr("usage_instructions"),
    source_url: getStr("source_url"),
    image_url: getStr("image_url"),
  };
}

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

async function fetchAndUploadImage(imageUrl: string, userId: string): Promise<string | null> {
  if (!imageUrl?.startsWith("http")) return null;
  if (isUrlBlockedForSSRF(imageUrl)) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GardenTracker/1.0)" },
    });
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
  clearTimeout(timeoutId);

  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.split(";")[0].trim().toLowerCase().startsWith("image/")) return null;

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sharp = (await import("sharp")).default;
  const compressed = await sharp(buffer)
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const path = `${userId}/supply-enrich-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const { error } = await admin.storage
    .from("journal-photos")
    .upload(path, compressed, { contentType: "image/jpeg", upsert: false });

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
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const brand = typeof body?.brand === "string" ? body.brand.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" },
        { status: 503 }
      );
    }

    const searchQuery = brand ? `${brand} ${name}` : name;
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${ENRICH_PROMPT}\n\nProduct to search for: ${searchQuery}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = response?.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "Could not find product details" }, { status: 422 });
    }

    const result = parseEnrichJson(text);
    if (!result) {
      return NextResponse.json({ error: "Could not parse extracted data" }, { status: 422 });
    }

    let primary_image_path: string | null = null;
    if (result.image_url) {
      primary_image_path = await fetchAndUploadImage(result.image_url, user.id);
    }
    delete result.image_url;

    logApiUsageAsync({ userId: user.id, provider: "gemini", operation: "supply-enrich-from-name" });

    return NextResponse.json({
      ...result,
      primary_image_path: primary_image_path ?? undefined,
    });
  } catch (e) {
    console.error("[supply/enrich-from-name]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}
