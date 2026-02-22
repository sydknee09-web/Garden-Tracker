import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeVendorKey } from "@/lib/vendorNormalize";
import { logApiUsageAsync } from "@/lib/logApiUsage";

export const maxDuration = 30;

/** Gallery mode: filter broken tiles before showing to the user (short timeout). */
const GALLERY_IMAGE_CHECK_TIMEOUT_MS = 2_500;

/** Check if an image URL responds 200 on HEAD (used only in gallery mode). */
async function checkImageAccessible(
  url: string,
  timeoutMs: number = GALLERY_IMAGE_CHECK_TIMEOUT_MS
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

/** Check multiple URLs in parallel; return those that respond 200. */
async function filterAccessibleUrls(urls: string[], timeoutMs: number = GALLERY_IMAGE_CHECK_TIMEOUT_MS): Promise<string[]> {
  const valid = urls.filter((u) => u?.trim().startsWith("http"));
  if (valid.length === 0) return [];
  const results = await Promise.all(
    valid.map(async (url) => ((await checkImageAccessible(url, timeoutMs)) ? url : null))
  );
  return results.filter((u): u is string => u != null);
}

/**
 * Download an external image URL and upload it to Supabase Storage.
 * Returns the storage path, or null if the download/upload fails.
 * Called server-side after Gemini finds a URL so we never store raw external links.
 */
async function downloadAndStore(
  url: string,
  userId: string,
  profileId: string
): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12_000);
    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; GardenTracker/1.0; +https://github.com/garden-tracker)",
        },
      });
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    const rawType = contentType.split(";")[0].trim().toLowerCase();
    if (!rawType.startsWith("image/") && rawType !== "application/octet-stream") return null;
    const blob = await res.blob();
    const type = rawType.startsWith("image/") ? (contentType.split(";")[0].trim() || "image/jpeg") : "image/jpeg";
    const ext = type.includes("png") ? "png" : "jpg";
    const path = `${userId}/hero-${profileId}-from-web-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await admin.storage
      .from("journal-photos")
      .upload(path, blob, { contentType: type, upsert: false });
    if (error) return null;
    return path;
  } catch {
    return null;
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
    const profile_id = typeof body?.profile_id === "string" ? body.profile_id.trim() : "";
    /** When true (e.g. Set Profile Photo modal), single Gemini pass, return multiple URLs for user to pick. */
    const gallery = body?.gallery === true;
    const logLabel = `${name} ${(variety || "").trim()}`.trim() || name;
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    // -------------------------------------------------------------------------
    // Gallery mode always goes straight to Gemini — no cache.
    // The gallery is the user's explicit "browse and pick" action, so they need
    // fresh embeddable results every time, not stale single-image cache entries.
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // Non-gallery cache: return cached hero URL without any Gemini call.
    // -------------------------------------------------------------------------
    if (!gallery && identity_key && token) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user?.id) {
        // Tier 2: plant_extract_cache (user-specific, storage path or original_hero_url)
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
        if (cachedRow && "hero_storage_path" in cachedRow && cachedRow.hero_storage_path) {
          const { data: pubUrl } = supabase.storage.from("journal-photos").getPublicUrl(cachedRow.hero_storage_path as string);
          if (pubUrl?.publicUrl) {
            console.log(`[find-hero-photo] Tier 2 cache hit (storage path) for ${logLabel}`);
            return NextResponse.json({ hero_image_url: pubUrl.publicUrl, hero_image_path: cachedRow.hero_storage_path });
          }
        }
        // Tier 2: original_hero_url (external) — return immediately, browser will try it
        const extractOrdered = vendorKeyExtract && extractRows?.length
          ? [...extractRows.filter((r) => normalizeVendorKey((r as { vendor?: string | null }).vendor ?? "") === vendorKeyExtract), ...extractRows.filter((r) => normalizeVendorKey((r as { vendor?: string | null }).vendor ?? "") !== vendorKeyExtract)]
          : extractRows ?? [];
        const extractOrigUrl = extractOrdered
          .map((r) => (r.original_hero_url as string)?.trim())
          .find((u): u is string => !!u && u.startsWith("http"));
        if (extractOrigUrl) {
          console.log(`[find-hero-photo] Tier 2 cache hit (original_hero_url) for ${logLabel}`);
          return NextResponse.json({ hero_image_url: extractOrigUrl });
        }

        // Tier 0.5: global_plant_cache (shared across users)
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
          const gpcUrl = ordered
            .map((row) => {
              const ed = row?.extract_data as Record<string, unknown> | undefined;
              const fromExtract = typeof ed?.hero_image_url === "string" ? String(ed.hero_image_url).trim() : "";
              return (row?.original_hero_url as string)?.trim() || fromExtract || "";
            })
            .find((u) => u.startsWith("http"));
          if (gpcUrl) {
            console.log(`[find-hero-photo] Tier 0.5 cache hit (global_plant_cache) for ${logLabel}`);
            return NextResponse.json({ hero_image_url: gpcUrl });
          }
        }

        // Tier 3: seed_import_logs (legacy)
        const { data: logRows } = await supabase
          .from("seed_import_logs")
          .select("hero_image_url")
          .eq("user_id", user.id)
          .eq("identity_key_generated", identity_key)
          .eq("status_code", 200)
          .not("hero_image_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(1);
        if (logRows?.[0]?.hero_image_url) {
          const cachedUrl = (logRows[0].hero_image_url as string).trim();
          if (cachedUrl.startsWith("http")) {
            console.log(`[find-hero-photo] Tier 3 cache hit (seed_import_logs) for ${logLabel}`);
            return NextResponse.json({ hero_image_url: cachedUrl });
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // AI search
    // -------------------------------------------------------------------------
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" }, { status: 503 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // -----------------------------------------------------------------------
    // Gallery mode: Wikimedia Commons API first (no AI, no rate limits,
    // guaranteed embeddable URLs). Gemini only supplements if needed.
    // -----------------------------------------------------------------------
    if (gallery) {
      const CATALOG_SUFFIXES = /\b(Series|Mix|Blend|Formula|Collection|Mixture|Hybrid|F1)\b/gi;
      const cleanedVariety = variety.replace(CATALOG_SUFFIXES, "").replace(/\s+/g, " ").trim();
      // Build queries: specific first (e.g. "French Durango Marigold"), then genus-only ("Marigold")
      const specificQuery = [cleanedVariety, name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      const genericQuery = (scientific_name?.trim() || name || "").trim();
      const searchQueries = [...new Set([specificQuery, genericQuery].filter(Boolean))];

      // ---- Wikimedia Commons API ----
      const wikimediaUrls: string[] = [];
      for (const q of searchQueries) {
        if (wikimediaUrls.length >= 9) break;
        try {
          const wikiApiUrl =
            `https://commons.wikimedia.org/w/api.php` +
            `?action=query&generator=search` +
            `&gsrsearch=${encodeURIComponent(q)}` +
            `&gsrnamespace=6&gsrlimit=20` +
            `&prop=imageinfo&iiprop=url|mime` +
            `&format=json&origin=*`;
          const wikiRes = await fetch(wikiApiUrl, {
            headers: { "User-Agent": "GardenTracker/1.0 (botanical app)" },
          }).catch(() => null);
          if (!wikiRes?.ok) continue;
          const wikiData = await wikiRes.json() as {
            query?: { pages?: Record<string, { imageinfo?: Array<{ url: string; mime: string }> }> };
          };
          const pages = Object.values(wikiData?.query?.pages ?? {});
          for (const page of pages) {
            const info = page.imageinfo?.[0];
            if (!info?.url) continue;
            const mime = (info.mime ?? "").toLowerCase();
            // Skip SVG, GIF, and non-images
            if (!mime.startsWith("image/") || mime.includes("svg") || mime.includes("gif")) continue;
            if (!wikimediaUrls.includes(info.url)) wikimediaUrls.push(info.url);
            if (wikimediaUrls.length >= 12) break;
          }
        } catch { /* non-fatal */ }
      }

      console.log(`[hero] Gallery Wikimedia: ${logLabel} → ${wikimediaUrls.length} urls`);

      // If Wikimedia gave us plenty, return immediately — no Gemini needed
      if (wikimediaUrls.length >= 4) {
        return NextResponse.json({ urls: wikimediaUrls });
      }

      // ---- Gemini supplement (for plants with few Wikimedia photos) ----
      const geminiQuery = specificQuery || genericQuery || "plant";
      const geminiPrompt = `Using Google Search, find 8 direct image URLs (https) of the actual plant, flower, or fruit for: "${geminiQuery}". Only photos of the growing plant — no seed packets, no product shots, no watermarked stock previews (shutterstock, alamy, dreamstime, getty, 123rf). Prefer pixabay.com, unsplash.com, pexels.com, staticflickr.com, and .edu sites. Each URL must be a direct image file (.jpg, .jpeg, .png, .webp). Return only valid JSON: { "urls": ["https://...", ...] }.`;

      let geminiResponse: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
      try {
        geminiResponse = await Promise.race([
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: geminiPrompt,
            config: { tools: [{ googleSearch: {} }] },
          }),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 20_000)),
        ]).catch(() => null);
      } catch {
        geminiResponse = null;
      }

      const geminiUrls: string[] = [];
      const geminiText = geminiResponse?.text?.trim() ?? "";
      const geminiMatch = geminiText.match(/\{[\s\S]*\}/);
      if (geminiMatch) {
        try {
          const parsed = JSON.parse(geminiMatch[0]) as { urls?: unknown };
          const raw = Array.isArray(parsed?.urls) ? parsed.urls : [];
          for (const u of raw) {
            if (typeof u === "string" && u.trim().startsWith("http")) geminiUrls.push(u.trim());
          }
        } catch { /* leave empty */ }
      }

      // Merge: Wikimedia first (always embeddable), then Gemini (HEAD-filtered)
      const combined = [...wikimediaUrls];
      if (geminiUrls.length > 0) {
        const accessible = await filterAccessibleUrls(geminiUrls);
        const supplement = accessible.length > 0 ? accessible : geminiUrls;
        for (const u of supplement) {
          if (!combined.includes(u)) combined.push(u);
        }
      }

      console.log(`[hero] Gallery combined: ${logLabel} → ${wikimediaUrls.length} wikimedia + ${geminiUrls.length} gemini = ${combined.length} total`);

      if (combined.length === 0) {
        return NextResponse.json({ urls: [], error: "No images found. Try again." });
      }
      if (token) {
        const sb = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
        const { data: { user } } = await sb.auth.getUser(token);
        if (user?.id) logApiUsageAsync({ userId: user.id, provider: "gemini", operation: "find-hero-photo-gallery" });
      }
      return NextResponse.json({ urls: combined });
    }

    // -----------------------------------------------------------------------
    // Non-gallery: single Gemini call, auto-download result to storage.
    // No HEAD checks — the browser handles it; we just save to storage.
    // -----------------------------------------------------------------------
    const GENERIC_PLANT_TYPES = ["grass", "vine", "vegetable", "flower"];
    const isGenericPlantType = (t: string) => GENERIC_PLANT_TYPES.includes((t || "").toLowerCase().trim());
    const isRareSeedsVendor = /rareseeds?/i.test(vendor);
    const restoreOrphanPunctuation = (s: string) =>
      (s || "").replace(/\bS\b/g, "'s").replace(/\bT\b/g, "'t");
    const cleanVarietyPart = restoreOrphanPunctuation(
      variety
        .replace(/\bSeeds?\b/gi, "")
        .replace(/\b(Series|Mix|Blend|Formula|Collection|Mixture)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    );
    const isVarietyIncludesType = cleanVarietyPart.toLowerCase().includes(name.toLowerCase());
    let finalQuery = cleanVarietyPart;
    if (!isGenericPlantType(name) && !isVarietyIncludesType && cleanVarietyPart) {
      finalQuery = `${cleanVarietyPart} ${name}`.trim();
    }
    const searchQuery = isRareSeedsVendor && variety
      ? `${restoreOrphanPunctuation(variety).trim()} Rare Seeds`
      : finalQuery || name;
    const primaryQuery = `${searchQuery} botanical plant -packet -seeds -plate -food -hands`.replace(/\s+/g, " ").trim();

    console.log(`[hero] Start: ${logLabel}`);
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    try {
      response = await Promise.race([
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `${HERO_SEARCH_PROMPT}\n\nSearch for: ${primaryQuery}`,
          config: { tools: [{ googleSearch: {} }] },
        }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 20_000)),
      ]).catch(() => null);
    } catch {
      response = null;
    }

    const text = response?.text?.trim() ?? "";
    let url = "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        const raw =
          (typeof parsed.hero_image_url === "string" && parsed.hero_image_url.trim()) ||
          (typeof parsed.image_url === "string" && parsed.image_url.trim()) ||
          (typeof parsed.url === "string" && parsed.url.trim()) ||
          (typeof parsed.stock_photo_url === "string" && parsed.stock_photo_url.trim()) ||
          "";
        if (raw.startsWith("http")) url = raw;
      } catch { /* leave url empty */ }
    }

    // If first pass failed, retry with a simpler query (just plant name, no variety)
    if (!url && name) {
      const fallbackQuery = `${name} plant botanical -packet -seeds`.replace(/\s+/g, " ").trim();
      console.log(`[hero] Retry with simpler query: ${fallbackQuery}`);
      let retryResponse: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
      try {
        retryResponse = await Promise.race([
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${HERO_SEARCH_PROMPT}\n\nSearch for: ${fallbackQuery}`,
            config: { tools: [{ googleSearch: {} }] },
          }),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 15_000)),
        ]).catch(() => null);
      } catch {
        retryResponse = null;
      }
      const retryText = retryResponse?.text?.trim() ?? "";
      const retryMatch = retryText.match(/\{[\s\S]*\}/);
      if (retryMatch) {
        try {
          const parsed = JSON.parse(retryMatch[0]) as Record<string, unknown>;
          const raw =
            (typeof parsed.hero_image_url === "string" && parsed.hero_image_url.trim()) ||
            (typeof parsed.image_url === "string" && parsed.image_url.trim()) ||
            (typeof parsed.url === "string" && parsed.url.trim()) ||
            (typeof parsed.stock_photo_url === "string" && parsed.stock_photo_url.trim()) ||
            "";
          if (raw.startsWith("http")) url = raw;
        } catch { /* leave url empty */ }
      }
      if (url) {
        console.log(`[hero] Retry success: ${logLabel}`);
      }
    }

    if (!url) {
      if (!response) {
        console.log(`[hero] Timeout: ${logLabel}`);
        return NextResponse.json({ hero_image_url: "", error: "Search took too long. Please try again." });
      }
      console.log(`[hero] Fail: ${logLabel}`);
      return NextResponse.json({ hero_image_url: "", error: "No images found for this variety" });
    }

    // -----------------------------------------------------------------------
    // Auto-download to Supabase Storage — no more external URL rot.
    // If download fails, fall back to the external URL (better than nothing).
    // -----------------------------------------------------------------------
    const idKey = identity_key?.trim() || identityKeyFromVariety(name || "Imported seed", variety || "");
    let storagePath: string | null = null;

    if (token) {
      const sb = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await sb.auth.getUser(token);
      if (user?.id) {
        logApiUsageAsync({ userId: user.id, provider: "gemini", operation: "find-hero-photo" });
        // Download the image server-side and store it in journal-photos bucket
        const pid = profile_id || "unknown";
        storagePath = await downloadAndStore(url, user.id, pid);

        // Write back to plant_extract_cache
        if (idKey) {
          try {
            await sb.from("plant_extract_cache").upsert(
              {
                user_id: user.id,
                source_url: `hero:${idKey}`,
                identity_key: idKey,
                vendor: vendor?.trim() || null,
                extract_data: { type: name || "Imported seed", variety: variety || "", vendor: vendor || "" },
                original_hero_url: url,
                hero_storage_path: storagePath || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,source_url" }
            );
          } catch { /* non-fatal */ }
        }
      }
    }

    // Write to global_plant_cache so other users benefit from this AI search
    if (idKey) {
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
            await admin.from("global_plant_cache").upsert(
              {
                source_url: `hero:${idKey}:${vendorNorm}`,
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
      } catch { /* non-fatal */ }
    }

    console.log(`[hero] Success: ${logLabel}${storagePath ? " (stored)" : " (external URL)"}`);

    // Return storage path if we managed to download, else return the external URL as fallback
    if (storagePath) {
      const admin = getSupabaseAdmin();
      const { data: pubUrl } = admin
        ? admin.storage.from("journal-photos").getPublicUrl(storagePath)
        : { data: null };
      return NextResponse.json({
        hero_image_url: pubUrl?.publicUrl || url,
        hero_image_path: storagePath,
      });
    }

    return NextResponse.json({ hero_image_url: url });
  } catch (e) {
    console.error("Find hero photo error:", e);
    const message = e instanceof Error ? e.message : "Failed to find hero photo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
