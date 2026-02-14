import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { normalizeVendorKey } from "@/lib/vendorNormalize";

export const maxDuration = 30;

const PASS_TIMEOUT_MS = 15_000;
const IMAGE_CHECK_TIMEOUT_MS = 5_000;

/** Check if image URL is accessible (200). Returns false for 403 or other non-2xx so we skip blocked Rare Seeds etc. */
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

const HERO_SEARCH_PROMPT = `You are a professional botanical curator. Using Google Search Grounding, find an image URL that follows these rules:

Subject: Must show the actual growing plant, flower, or fruit (not a seed packet).
Quality: Prioritize high-resolution, clear lighting, and natural settings. Prioritize clear, well-lit images of the plant or fruit (for edible crops).
Strictly Prohibited: No seed packets, no hands/people, no cooked food, no cutting boards, and no watermarked stock previews (e.g. Alamy, Getty).
Preferred Sources: Look for educational sites, university extensions, or reputable nurseries (e.g. Rare Seeds, Johnny's, Wikimedia).

Return a single JSON object only (no markdown, no explanation):
- hero_image_url: a direct URL (https://...) to an image that meets the rules above. Use empty string if none found.

Return only valid JSON.`;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const variety = typeof body?.variety === "string" ? body.variety.trim() : "";
    const vendor = typeof body?.vendor === "string" ? body.vendor.trim() : "";
    const scientific_name = typeof body?.scientific_name === "string" ? body.scientific_name.trim() : "";
    const identity_key = typeof body?.identity_key === "string" ? body.identity_key.trim() : "";
    const logLabel = `${name} ${(variety || "").trim()}`.trim() || name;
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    // Phase 0 (Vault check): if we have identity_key and auth, return cached hero URL when status was 200
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (identity_key && token) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user?.id) {
        // Tier 2: check plant_extract_cache for stored hero image (owned file in journal-photos bucket, no HEAD check needed)
        const { data: extractRows } = await supabase
          .from("plant_extract_cache")
          .select("hero_storage_path, vendor")
          .eq("user_id", user.id)
          .eq("identity_key", identity_key)
          .not("hero_storage_path", "is", null)
          .order("updated_at", { ascending: false })
          .limit(5);
        const vendorKeyExtract = normalizeVendorKey(vendor);
        const cachedRow = extractRows?.length
          ? (vendorKeyExtract
              ? extractRows.find((r) => normalizeVendorKey((r as { vendor?: string | null }).vendor ?? "") === vendorKeyExtract) ?? extractRows[0]
              : extractRows[0])
          : null;
        if (cachedRow && "hero_storage_path" in cachedRow && cachedRow.hero_storage_path) {
          const { data: pubUrl } = supabase.storage.from("journal-photos").getPublicUrl(cachedRow.hero_storage_path as string);
          if (pubUrl?.publicUrl) {
            console.log(`[find-hero-photo] Tier 2 cache hit (plant_extract_cache) for ${logLabel}`);
            return NextResponse.json({ hero_image_url: pubUrl.publicUrl });
          }
        }

        // Tier 0.5: global_plant_cache by identity_key (reuse bulk-scraped hero URLs; detailed-then-loosen: prefer vendor match)
        const { data: gpcRows } = await supabase
          .from("global_plant_cache")
          .select("original_hero_url, extract_data, vendor")
          .eq("identity_key", identity_key)
          .order("updated_at", { ascending: false })
          .limit(5);
        if (gpcRows?.length) {
          const vendorKey = normalizeVendorKey(vendor);
          const withVendor = vendorKey ? gpcRows.find((r) => normalizeVendorKey((r as { vendor?: string }).vendor ?? "") === vendorKey) : null;
          const row = withVendor ?? gpcRows[0];
          const ed = row?.extract_data as Record<string, unknown> | undefined;
          const heroFromExtract = typeof ed?.hero_image_url === "string" ? String(ed.hero_image_url).trim() : "";
          const heroFromRow =
            (row?.original_hero_url as string)?.trim() || heroFromExtract || "";
          if (heroFromRow.startsWith("http") && (await checkImageAccessible(heroFromRow))) {
            console.log(`[find-hero-photo] Tier 0.5 cache hit (global_plant_cache) for ${logLabel}`);
            return NextResponse.json({ hero_image_url: heroFromRow });
          }
        }

        // Fallback: check seed_import_logs for cached external hero URL (requires HEAD accessibility check)
        const { data: rows, error: selectError } = await supabase
          .from("seed_import_logs")
          .select("hero_image_url")
          .eq("user_id", user.id)
          .eq("identity_key_generated", identity_key)
          .eq("status_code", 200)
          .not("hero_image_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(1);
        if (!selectError && rows?.[0]?.hero_image_url) {
          const cachedUrl = (rows[0].hero_image_url as string).trim();
          if (cachedUrl.startsWith("http") && (await checkImageAccessible(cachedUrl))) {
            return NextResponse.json({ hero_image_url: cachedUrl });
          }
        }
      }
    }

    // --- AI search: detailed then loosen ---
    // Pass 1 (detailed): Prefer query that includes vendor + plant + variety. Cache lookups above
    // (plant_extract_cache, global_plant_cache, seed_import_logs) already prefer hero from cache.
    // First AI attempt uses searchQuery built from variety + name (and for Rare Seeds includes vendor).
    // Pass 2+ (loosen): If no result, later attempts strip vendor (Rare Seeds fallback, flat-name retry,
    // botanical retry, scientific_name pass) so we try plant+variety or variety-only.

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const passNum = typeof body?.pass === "number" ? body.pass : 0;
    const isPass4OrHigher = passNum >= 4;
    const stripSeedsFromQuery = (q: string) =>
      q.replace(/\bSeeds\b/gi, "").replace(/\bSeed\b/gi, "").replace(/\s+/g, " ").trim();
    // Restore orphan S/T for search clarity (e.g. "Job S Tears" -> "Job's Tears")
    const restoreOrphanPunctuation = (s: string) =>
      (s || "").replace(/\bS\b/g, "'s").replace(/\bT\b/g, "'t");

    const GENERIC_PLANT_TYPES = ["grass", "vine", "vegetable", "flower"];
    const isGenericPlantType = (t: string) => GENERIC_PLANT_TYPES.includes((t || "").toLowerCase().trim());

    // Pass 4+: ultra-clean — strip Seeds, Seed, and vendor name entirely
    const ultraClean = (varietyStr: string, vendorStr: string) => {
      let t = (varietyStr || "")
        .replace(/\bSeeds\b/gi, "")
        .replace(/\bSeed\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (vendorStr) {
        const escaped = vendorStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        t = t.replace(new RegExp(escaped, "gi"), "").replace(/\s+/g, " ").trim();
      }
      return t;
    };

    let varietyPart = variety;
    if (isPass4OrHigher) varietyPart = ultraClean(variety, vendor);
    varietyPart = restoreOrphanPunctuation(varietyPart).replace(/\s+/g, " ").trim();
    const cleanPlantType = name.toLowerCase();
    const cleanVariety = varietyPart.toLowerCase();
    let finalQuery = varietyPart;
    if (!isGenericPlantType(name) && !cleanVariety.includes(cleanPlantType)) {
      finalQuery = `${varietyPart} ${name}`.trim();
    }
    const isRareSeedsVendor = /rareseeds?/i.test(vendor);
    const searchQueryRaw = isPass4OrHigher
      ? (finalQuery || name || "plant")
      : isRareSeedsVendor && variety
        ? `${restoreOrphanPunctuation(variety).replace(/\s+/g, " ").trim()} Rare Seeds`
        : finalQuery || name || "plant";
    const searchQuery = isPass4OrHigher ? searchQueryRaw : stripSeedsFromQuery(searchQueryRaw);
    const primaryQuery = `${searchQuery} botanical close-up "on the vine" OR "in the garden" -packet -seeds -plate -food`;
    const promptFor = (query: string) => `${HERO_SEARCH_PROMPT}\n\nSearch for: ${query}`;
    const searchWithQuery = (query: string) =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptFor(query),
        config: { tools: [{ googleSearch: {} }] },
      });

    const parseUrlFromResponse = (response: Awaited<ReturnType<typeof ai.models.generateContent>> | null): string => {
      const text = response?.text?.trim() ?? "";
      if (!text) return "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return "";
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        const raw =
          (typeof parsed.hero_image_url === "string" && parsed.hero_image_url.trim()) ||
          (typeof parsed.image_url === "string" && parsed.image_url.trim()) ||
          (typeof parsed.url === "string" && parsed.url.trim()) ||
          (typeof parsed.stock_photo_url === "string" && parsed.stock_photo_url.trim()) ||
          "";
        return raw.startsWith("http") ? raw : "";
      } catch {
        return "";
      }
    };

    console.log(`[hero] Start: ${logLabel}`);
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    try {
      response = await Promise.race([
        searchWithQuery(primaryQuery),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), PASS_TIMEOUT_MS)
        ),
      ]);
    } catch (e) {
      if (e instanceof Error && e.message === "TIMEOUT") {
        const fallbackQuery = `${searchQuery} botanical close-up -packet -seeds -plate -food`;
        response = await searchWithQuery(fallbackQuery);
      } else {
        throw e;
      }
    }

    let url = parseUrlFromResponse(response);
    if (url && !(await checkImageAccessible(url))) {
      url = "";
    }
    // Rare Seeds: if vendor-specific search failed or returned 403, strip vendor and search Plant Type + Variety + "high resolution"
    if (!url && isRareSeedsVendor && (name || varietyPart)) {
      const relaxedQuery = `${finalQuery || name} ${varietyPart} high resolution`.replace(/\s+/g, " ").trim();
      try {
        const relaxedResponse = await Promise.race([
          searchWithQuery(relaxedQuery),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("TIMEOUT")), PASS_TIMEOUT_MS)
          ),
        ]).catch(() => null);
        url = parseUrlFromResponse(relaxedResponse);
        if (url && !(await checkImageAccessible(url))) url = "";
      } catch {
        // keep url empty
      }
    }
    // Multi-attempt bridge: if Pretty Name search found nothing, try Flat Name (apostrophes stripped, e.g. "Benarys Giant")
    if (!url && varietyPart && varietyPart !== varietyPart.replace(/'/g, "")) {
      const flatVarietyPart = varietyPart.replace(/'/g, "");
      let searchQueryFlat = flatVarietyPart;
      if (!isGenericPlantType(name) && !flatVarietyPart.toLowerCase().includes(name.toLowerCase())) {
        searchQueryFlat = `${flatVarietyPart} ${name}`.trim();
      }
      searchQueryFlat = (isPass4OrHigher ? searchQueryFlat : stripSeedsFromQuery(searchQueryFlat)) || name || "plant";
      const flatQuery = `${searchQueryFlat} botanical close-up -packet -seeds -plate -food`;
        try {
          const responseFlat = await Promise.race([
            searchWithQuery(flatQuery),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("TIMEOUT")), PASS_TIMEOUT_MS)
            ),
          ]).catch(() => null);
          url = parseUrlFromResponse(responseFlat);
          if (url && !(await checkImageAccessible(url))) url = "";
        } catch {
          // keep url empty
        }
    }
    // Final retry (Spanish Eyes fix): type + variety + " botanical" to resolve to scientific/plant results
    if (!url && (name || variety)) {
      const botanicalQuery = `${name} ${variety} botanical`.replace(/\s+/g, " ").trim();
      try {
        const botResponse = await Promise.race([
          searchWithQuery(botanicalQuery),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("TIMEOUT")), PASS_TIMEOUT_MS)
          ),
        ]).catch(() => null);
        url = parseUrlFromResponse(botResponse);
        if (url && !(await checkImageAccessible(url))) url = "";
      } catch {
        // keep url empty
      }
    }
    // Pass 5: scientific_name as primary anchor; -site:rareseeds.com to avoid blocked Rare Seeds images
    if (!url && scientific_name) {
      const pass5Query = `${scientific_name} ${variety} -site:rareseeds.com`.replace(/\s+/g, " ").trim();
      try {
        const pass5Response = await Promise.race([
          searchWithQuery(`${pass5Query} high resolution botanical -packet -seeds -plate -food`),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("TIMEOUT")), PASS_TIMEOUT_MS)
          ),
        ]).catch(() => null);
        url = parseUrlFromResponse(pass5Response);
        if (url && !(await checkImageAccessible(url))) url = "";
      } catch {
        // keep url empty
      }
    }
    if (!url) {
      console.log(`[hero] Fail: ${logLabel}`);
      return NextResponse.json({ hero_image_url: "", error: "No images found for this variety" });
    }

    // Prefer .jpg or .png for UI compatibility; if .webp or no extension, try one more search for jpg/png
    const needsJpgOrPng =
      url.toLowerCase().endsWith(".webp") ||
      !/\.(jpg|jpeg|png|gif)(\?|$)/i.test(url);
    if (needsJpgOrPng) {
      const jpgPrompt = `Using Google Search Grounding, find a direct URL to a high-quality .jpg or .png image of the actual plant/flower/fruit (not seed packet, not food on plate) for: ${searchQuery}. Prefer educational or nursery sources. Return only valid JSON: { "hero_image_url": "https://...jpg or ...png" }. Use empty string if none found.`;
      try {
        const jpgResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: jpgPrompt,
          config: { tools: [{ googleSearch: {} }] },
        });
        const jpgText = jpgResponse?.text?.trim() ?? "";
        const jpgMatch = jpgText.match(/\{[\s\S]*\}/);
        if (jpgMatch) {
          const jpgParsed = JSON.parse(jpgMatch[0]) as Record<string, unknown>;
          const jpgUrl =
            (typeof jpgParsed.hero_image_url === "string" && jpgParsed.hero_image_url.trim()) ||
            (typeof jpgParsed.image_url === "string" && jpgParsed.image_url.trim()) ||
            "";
          if (jpgUrl.startsWith("http") && /\.(jpg|jpeg|png)(\?|$)/i.test(jpgUrl)) {
            if (await checkImageAccessible(jpgUrl)) url = jpgUrl;
          }
        }
      } catch {
        // keep original url if jpg/png search fails
      }
    }

    console.log(`[hero] Success: ${logLabel}`);
    return NextResponse.json({ hero_image_url: url });
  } catch (e) {
    console.error("Find hero photo error:", e);
    const message = e instanceof Error ? e.message : "Failed to find hero photo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
