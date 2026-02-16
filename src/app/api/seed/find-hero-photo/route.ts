import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeVendorKey } from "@/lib/vendorNormalize";

export const maxDuration = 30;

const PASS_TIMEOUT_MS = 15_000;
/** Single-pass timeout for "Search web" modal so we stay well under maxDuration (30s). */
const QUICK_PASS_TIMEOUT_MS = 16_000;
const IMAGE_CHECK_TIMEOUT_MS = 5_000;
/** In quick mode use a shorter HEAD timeout so we fail fast and stay under maxDuration. */
const QUICK_IMAGE_CHECK_TIMEOUT_MS = 3_000;

/** Check if image URL is accessible (200). Returns false for 403 or other non-2xx so we skip blocked Rare Seeds etc. */
async function checkImageAccessible(
  url: string,
  timeoutMs: number = IMAGE_CHECK_TIMEOUT_MS
): Promise<boolean> {
  if (!url?.startsWith("http")) return false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** Check multiple URLs in parallel; return the first that is accessible (200), or null. */
async function checkFirstAccessible(
  urls: string[],
  timeoutMs: number = IMAGE_CHECK_TIMEOUT_MS
): Promise<string | null> {
  const valid = urls.filter((u) => u?.trim().startsWith("http"));
  if (valid.length === 0) return null;
  const results = await Promise.all(
    valid.map(async (url) => ((await checkImageAccessible(url, timeoutMs)) ? url : null))
  );
  return results.find((u) => u != null) ?? null;
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
    /** When true (e.g. Set Profile Photo modal), do one Gemini pass only so we stay under maxDuration and don't time out. */
    const quick = body?.quick === true;
    /** When true, return multiple image URLs for gallery picker; no heavy filtering, user picks. */
    const gallery = body?.gallery === true;
    const logLabel = `${name} ${(variety || "").trim()}`.trim() || name;
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    // Gallery cache: return any cached hero URLs for this plant immediately (no Gemini). Makes repeat opens instant.
    if (gallery && identity_key && token) {
      const supabaseGallery = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: authError } = await supabaseGallery.auth.getUser(token);
      if (!authError && user?.id) {
        const collected: string[] = [];
        const { data: extractRows } = await supabaseGallery
          .from("plant_extract_cache")
          .select("hero_storage_path, original_hero_url")
          .eq("user_id", user.id)
          .eq("identity_key", identity_key)
          .or("hero_storage_path.not.is.null,original_hero_url.not.is.null")
          .limit(10);
        for (const r of extractRows ?? []) {
          const path = (r as { hero_storage_path?: string | null }).hero_storage_path;
          if (path?.trim()) {
            const { data: pub } = supabaseGallery.storage.from("journal-photos").getPublicUrl(path.trim());
            if (pub?.publicUrl) collected.push(pub.publicUrl);
          }
          const orig = (r as { original_hero_url?: string | null }).original_hero_url;
          if (typeof orig === "string" && orig.trim().startsWith("http")) collected.push(orig.trim());
        }
        const { data: gpcRows } = await supabaseGallery
          .from("global_plant_cache")
          .select("original_hero_url, extract_data")
          .eq("identity_key", identity_key)
          .not("original_hero_url", "is", null)
          .limit(10);
        for (const row of gpcRows ?? []) {
          const u = (row as { original_hero_url?: string }).original_hero_url?.trim();
          if (u && u.startsWith("http")) collected.push(u);
          const ed = (row as { extract_data?: { hero_image_url?: string } }).extract_data;
          const fromExtract = typeof ed?.hero_image_url === "string" ? ed.hero_image_url.trim() : "";
          if (fromExtract.startsWith("http")) collected.push(fromExtract);
        }
        const deduped = [...new Set(collected)];
        if (deduped.length > 0) {
          console.log(`[find-hero-photo] Gallery cache hit: ${logLabel} → ${deduped.length} urls`);
          return NextResponse.json({ urls: deduped });
        }
      }
    }

    // Phase 0 (Vault check): if we have identity_key and auth, return cached hero URL when status was 200 (skip for gallery)
    if (!gallery && identity_key && token) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user?.id) {
        // Tier 2: check plant_extract_cache for stored hero (storage path or original_hero_url)
        const { data: extractRows } = await supabase
          .from("plant_extract_cache")
          .select("hero_storage_path, original_hero_url, vendor")
          .eq("user_id", user.id)
          .eq("identity_key", identity_key)
          .or("hero_storage_path.not.is.null,original_hero_url.not.is.null")
          .order("updated_at", { ascending: false })
          .limit(5);
        const vendorKeyExtract = normalizeVendorKey(vendor);
        const cachedRow = extractRows?.length
          ? (vendorKeyExtract
              ? extractRows.find((r) => normalizeVendorKey((r as { vendor?: string | null }).vendor ?? "") === vendorKeyExtract) ?? extractRows[0]
              : extractRows[0])
          : null;
        const headTimeoutMs = quick ? QUICK_IMAGE_CHECK_TIMEOUT_MS : IMAGE_CHECK_TIMEOUT_MS;
        if (cachedRow && "hero_storage_path" in cachedRow && cachedRow.hero_storage_path) {
          const { data: pubUrl } = supabase.storage.from("journal-photos").getPublicUrl(cachedRow.hero_storage_path as string);
          if (pubUrl?.publicUrl) {
            console.log(`[find-hero-photo] Tier 2 cache hit (plant_extract_cache) for ${logLabel}`);
            return NextResponse.json({ hero_image_url: pubUrl.publicUrl });
          }
        }
        const extractOrdered = vendorKeyExtract && extractRows?.length
          ? [...extractRows.filter((r) => normalizeVendorKey((r as { vendor?: string | null }).vendor ?? "") === vendorKeyExtract), ...extractRows.filter((r) => normalizeVendorKey((r as { vendor?: string | null }).vendor ?? "") !== vendorKeyExtract)]
          : extractRows ?? [];
        const extractOrigUrls = extractOrdered
          .map((r) => (r.original_hero_url as string)?.trim())
          .filter((u): u is string => !!u && u.startsWith("http"));
        if (extractOrigUrls.length > 0) {
          const firstOk = await checkFirstAccessible(extractOrigUrls, headTimeoutMs);
          if (firstOk) {
            console.log(`[find-hero-photo] Tier 2 cache hit (original_hero_url) for ${logLabel}`);
            return NextResponse.json({ hero_image_url: firstOk });
          }
        }

        // Tier 0.5: global_plant_cache by identity_key (reuse bulk-scraped hero URLs; check all candidates in parallel)
        const { data: gpcRows } = await supabase
          .from("global_plant_cache")
          .select("original_hero_url, extract_data, vendor")
          .eq("identity_key", identity_key)
          .order("updated_at", { ascending: false })
          .limit(5);
        if (gpcRows?.length) {
          const vendorKey = normalizeVendorKey(vendor);
          const ordered = vendorKey
            ? [...gpcRows.filter((r) => normalizeVendorKey((r as { vendor?: string }).vendor ?? "") === vendorKey), ...gpcRows.filter((r) => normalizeVendorKey((r as { vendor?: string }).vendor ?? "") !== vendorKey)]
            : gpcRows;
          const gpcUrls = ordered
            .map((row) => {
              const ed = row?.extract_data as Record<string, unknown> | undefined;
              const fromExtract = typeof ed?.hero_image_url === "string" ? String(ed.hero_image_url).trim() : "";
              return (row?.original_hero_url as string)?.trim() || fromExtract || "";
            })
            .filter((u) => u.startsWith("http"));
          if (gpcUrls.length > 0) {
            const firstOk = await checkFirstAccessible(gpcUrls, headTimeoutMs);
            if (firstOk) {
              console.log(`[find-hero-photo] Tier 0.5 cache hit (global_plant_cache) for ${logLabel}`);
              return NextResponse.json({ hero_image_url: firstOk });
            }
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
          if (cachedUrl.startsWith("http") && (await checkImageAccessible(cachedUrl, headTimeoutMs))) {
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

    // Gallery mode: one search for variety + plant, return multiple URLs for user to pick (no heavy filtering)
    if (gallery) {
      const galleryQuery = [variety, name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || name || "plant";
      const galleryPrompt = `Using Google Search, find 8 to 12 direct image URLs (https) that show this plant or flower: "${galleryQuery}". Prefer real plant/flower photos; avoid seed packet images. Return only valid JSON with no markdown: { "urls": [ "https://...", "https://..." ] }. Each element must be a direct image URL.`;
      const galleryTimeoutMs = QUICK_PASS_TIMEOUT_MS;
      let galleryResponse: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
      try {
        galleryResponse = await Promise.race([
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: galleryPrompt,
            config: { tools: [{ googleSearch: {} }] },
          }),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), galleryTimeoutMs)),
        ]).catch(() => null);
      } catch {
        galleryResponse = null;
      }
      const text = galleryResponse?.text?.trim() ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const urls: string[] = [];
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as { urls?: unknown };
          const raw = Array.isArray(parsed?.urls) ? parsed.urls : [];
          for (const u of raw) {
            if (typeof u === "string" && u.trim().startsWith("http")) urls.push(u.trim());
          }
        } catch {
          // leave urls empty
        }
      }
      if (urls.length === 0 && !galleryResponse) {
        return NextResponse.json({ urls: [], error: "Search took too long. Please try again." });
      }
      console.log(`[hero] Gallery: ${logLabel} → ${urls.length} urls`);
      return NextResponse.json({ urls });
    }

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
    /** Quick mode: simple query that works for flowers and veggies (no "on the vine" narrowing). */
    const quickQuery =
      `${(varietyPart ? `${varietyPart} ` : "")}${name} flower plant -packet -seeds`.replace(/\s+/g, " ").trim() ||
      `${name} plant -packet -seeds`;
    const promptFor = (query: string) => `${HERO_SEARCH_PROMPT}\n\nSearch for: ${query}`;
    const searchWithQuery = (query: string) =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptFor(query),
        config: { tools: [{ googleSearch: {} }] },
      });

    const searchWithTimeout = (
      query: string,
      timeoutMs: number
    ): Promise<Awaited<ReturnType<typeof ai.models.generateContent>> | null> =>
      Promise.race([
        searchWithQuery(query),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs)
        ),
      ]).catch(() => null);

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

    console.log(`[hero] Start: ${logLabel}${quick ? " (quick)" : ""}`);
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    const timeoutMs = quick ? QUICK_PASS_TIMEOUT_MS : PASS_TIMEOUT_MS;
    const firstQuery = quick ? quickQuery : primaryQuery;
    response = await searchWithTimeout(firstQuery, timeoutMs);
    if (!response && !quick) {
      const fallbackQuery = `${searchQuery} botanical close-up -packet -seeds -plate -food`;
      response = await searchWithTimeout(fallbackQuery, PASS_TIMEOUT_MS);
    }

    const imageCheckMs = quick ? QUICK_IMAGE_CHECK_TIMEOUT_MS : IMAGE_CHECK_TIMEOUT_MS;
    let url = parseUrlFromResponse(response);
    if (url && !(await checkImageAccessible(url, imageCheckMs))) {
      if (!quick) url = "";
      // Quick mode: keep URL even when HEAD fails — many hosts block server HEAD but allow browser; user can still try.
    }
    // Quick mode: if first pass failed (timeout) or no URL yet, try one simple fallback (e.g. "Alyssum Giga White flower")
    if (quick && !url) {
      const simpleQuery = `${name} ${variety} flower`.replace(/\s+/g, " ").trim() || `${name} plant`;
      const fallbackResponse = await searchWithTimeout(simpleQuery, Math.min(QUICK_PASS_TIMEOUT_MS, 10_000));
      url = parseUrlFromResponse(fallbackResponse);
      if (url && !(await checkImageAccessible(url, imageCheckMs))) {
        // Keep URL in quick mode so browser can try (referrerPolicy no-referrer often works when HEAD fails).
      }
    }
    if (!quick) {
      // Rare Seeds: if vendor-specific search failed or returned 403, strip vendor and search Plant Type + Variety + "high resolution"
      if (!url && isRareSeedsVendor && (name || varietyPart)) {
        const relaxedQuery = `${finalQuery || name} ${varietyPart} high resolution`.replace(/\s+/g, " ").trim();
        try {
          const relaxedResponse = await searchWithTimeout(relaxedQuery, PASS_TIMEOUT_MS);
          url = parseUrlFromResponse(relaxedResponse);
          if (url && !(await checkImageAccessible(url, imageCheckMs))) url = "";
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
          const responseFlat = await searchWithTimeout(flatQuery, PASS_TIMEOUT_MS);
          url = parseUrlFromResponse(responseFlat);
          if (url && !(await checkImageAccessible(url, imageCheckMs))) url = "";
        } catch {
          // keep url empty
        }
      }
      // Final retry (Spanish Eyes fix): type + variety + " botanical" to resolve to scientific/plant results
      if (!url && (name || variety)) {
        const botanicalQuery = `${name} ${variety} botanical`.replace(/\s+/g, " ").trim();
        try {
          const botResponse = await searchWithTimeout(botanicalQuery, PASS_TIMEOUT_MS);
          url = parseUrlFromResponse(botResponse);
          if (url && !(await checkImageAccessible(url, imageCheckMs))) url = "";
        } catch {
          // keep url empty
        }
      }
      // Pass 5: scientific_name as primary anchor; -site:rareseeds.com to avoid blocked Rare Seeds images
      if (!url && scientific_name) {
        const pass5Query = `${scientific_name} ${variety} -site:rareseeds.com`.replace(/\s+/g, " ").trim();
        try {
          const pass5Response = await searchWithTimeout(
            `${pass5Query} high resolution botanical -packet -seeds -plate -food`,
            PASS_TIMEOUT_MS
          );
          url = parseUrlFromResponse(pass5Response);
          if (url && !(await checkImageAccessible(url, imageCheckMs))) url = "";
        } catch {
          // keep url empty
        }
      }
    }
    if (!url) {
      if (quick && !response) {
        console.log(`[hero] Quick timeout: ${logLabel}`);
      }
      console.log(`[hero] Fail: ${logLabel}`);
      const noResultError =
        quick && !response
          ? "Search took too long. Please try again."
          : "No images found for this variety";
      return NextResponse.json({ hero_image_url: "", error: noResultError });
    }

    // Prefer .jpg or .png for UI compatibility; if .webp or no extension, try one more search for jpg/png (skip in quick mode)
    if (!quick) {
      const needsJpgOrPng =
        url.toLowerCase().endsWith(".webp") ||
        !/\.(jpg|jpeg|png|gif)(\?|$)/i.test(url);
      if (needsJpgOrPng) {
        const jpgPrompt = `Using Google Search Grounding, find a direct URL to a high-quality .jpg or .png image of the actual plant/flower/fruit (not seed packet, not food on plate) for: ${searchQuery}. Prefer educational or nursery sources. Return only valid JSON: { "hero_image_url": "https://...jpg or ...png" }. Use empty string if none found.`;
        try {
          const jpgResponse = await Promise.race([
            ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: jpgPrompt,
              config: { tools: [{ googleSearch: {} }] },
            }),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("TIMEOUT")), PASS_TIMEOUT_MS)
            ),
          ]).catch(() => null);
          if (jpgResponse) {
            const jpgText = (jpgResponse as { text?: string })?.text?.trim() ?? "";
            const jpgMatch = jpgText.match(/\{[\s\S]*\}/);
            if (jpgMatch) {
              const jpgParsed = JSON.parse(jpgMatch[0]) as Record<string, unknown>;
              const jpgUrl =
                (typeof jpgParsed.hero_image_url === "string" && jpgParsed.hero_image_url.trim()) ||
                (typeof jpgParsed.image_url === "string" && jpgParsed.image_url.trim()) ||
                "";
              if (jpgUrl.startsWith("http") && /\.(jpg|jpeg|png)(\?|$)/i.test(jpgUrl)) {
                if (await checkImageAccessible(jpgUrl, imageCheckMs)) url = jpgUrl;
              }
            }
          }
        } catch {
          // keep original url if jpg/png search fails
        }
      }
    }

    // Write back to plant_extract_cache so next time we hit Tier 2 (no Gemini call)
    const cacheAuth = req.headers.get("authorization");
    const tokenForCache = cacheAuth?.startsWith("Bearer ") ? cacheAuth.slice(7).trim() : null;
    const idKey = identity_key?.trim() || identityKeyFromVariety(name || "Imported seed", variety || "");
    if (url && tokenForCache) {
      try {
        const sb = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${tokenForCache}` } },
        });
        const { data: { user: cacheUser } } = await sb.auth.getUser(tokenForCache);
        if (cacheUser?.id && idKey) {
          await sb.from("plant_extract_cache").upsert(
            {
              user_id: cacheUser.id,
              source_url: `hero:${idKey}`,
              identity_key: idKey,
              vendor: vendor?.trim() || null,
              extract_data: { type: name || "Imported seed", variety: variety || "", vendor: vendor || "" },
              original_hero_url: url,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,source_url" }
          );
        }
      } catch {
        // non-fatal
      }
    }

    // Write to global_plant_cache so future lookups (any user) can use this hero without AI. Only when identity_key is non-empty; update existing row with null hero first, else insert synthetic row.
    if (url && idKey) {
      try {
        const admin = getSupabaseAdmin();
        if (admin) {
          const vendorNorm = normalizeVendorKey(vendor) || "default";
          const { data: existing } = await admin
            .from("global_plant_cache")
            .select("id")
            .eq("identity_key", idKey)
            .is("original_hero_url", null)
            .order("updated_at", { ascending: false })
            .limit(1);
          if (existing?.length && existing[0]?.id) {
            await admin
              .from("global_plant_cache")
              .update({ original_hero_url: url, updated_at: new Date().toISOString() })
              .eq("id", existing[0].id);
          } else {
            const syntheticSourceUrl = `hero:${idKey}:${vendorNorm}`;
            await admin.from("global_plant_cache").upsert(
              {
                source_url: syntheticSourceUrl,
                identity_key: idKey,
                vendor: vendor?.trim() || null,
                original_hero_url: url,
                extract_data: { type: name || "Imported seed", variety: variety || "", vendor: vendor || "" },
                scraped_fields: ["hero"],
                scrape_quality: "ai_hero",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "source_url" }
            );
          }
        }
      } catch {
        // non-fatal: profile and plant_extract_cache already updated
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
