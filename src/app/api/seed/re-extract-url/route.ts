import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { stripPlantFromVariety, cleanVarietyForDisplay } from "@/lib/varietyNormalize";

/**
 * Re-extract one URL and overwrite its global_plant_cache row.
 * Use from Settings → Developer to fix a single bad cache entry without running scripts.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "url required (must start with http)" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Server not configured for cache writes" }, { status: 503 });
    }

    const host =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : req.headers.get("x-forwarded-host")
          ? `https://${req.headers.get("x-forwarded-host")}`
          : "http://localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? host;

    const res = await fetch(`${baseUrl}/api/seed/scrape-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.error) {
      return NextResponse.json(
        { error: (data.error as string) ?? `Scrape failed: ${res.status}` },
        { status: res.ok ? 400 : res.status }
      );
    }

    const domain = (() => {
      try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
      } catch {
        return "unknown";
      }
    })();
    const VENDOR_MAP: { pattern: RegExp; vendor: string }[] = [
      { pattern: /rareseeds\.com/i, vendor: "Rare Seeds" },
      { pattern: /hudsonvalleyseed/i, vendor: "Hudson Valley Seed Co" },
      { pattern: /floretflowers\.com/i, vendor: "Floret" },
    ];
    let vendor = domain;
    for (const { pattern, vendor: v } of VENDOR_MAP) {
      if (pattern.test(domain)) {
        vendor = v;
        break;
      }
    }
    if (vendor === domain) {
      const name = domain.split(".")[0] ?? domain;
      vendor = name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    let typeNorm = String(data.plant_name ?? data.ogTitle ?? "").trim() || "";
    let varietyNorm = String(data.variety_name ?? "").trim();
    varietyNorm = stripPlantFromVariety(varietyNorm, typeNorm);
    const { cleanedVariety, tagsToAdd } = cleanVarietyForDisplay(varietyNorm, typeNorm);
    varietyNorm = cleanedVariety;
    const tagsRaw = Array.isArray(data.tags)
      ? (data.tags as string[]).filter((t) => typeof t === "string").map((t) => String(t).trim()).filter(Boolean)
      : [];
    const tagsMerged = [...tagsRaw];
    for (const t of tagsToAdd) {
      if (t && !tagsMerged.some((x) => x.toLowerCase() === t.toLowerCase())) tagsMerged.push(t);
    }
    const identityKey = identityKeyFromVariety(typeNorm || "Imported seed", varietyNorm);
    if (!typeNorm.trim() || !varietyNorm.trim() || !identityKey) {
      return NextResponse.json(
        { error: "Scrape returned insufficient type/variety for cache" },
        { status: 400 }
      );
    }

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

    const TRACKED_FIELDS = [
      "sun",
      "water",
      "plant_spacing",
      "days_to_germination",
      "harvest_days",
      "plant_description",
      "growing_notes",
      "imageUrl",
      "latin_name",
      "life_cycle",
      "hybrid_status",
    ] as const;
    const scrapedFields: string[] = [];
    for (const key of TRACKED_FIELDS) {
      const v = data[key];
      if (v != null && (typeof v !== "string" || v.trim())) scrapedFields.push(key);
      if (typeof v === "number" && !Number.isNaN(v)) scrapedFields.push(key);
    }
    const quality =
      (data.scrape_status as string) === "AI_SEARCH"
        ? "ai_only"
        : (data.scrape_status as string) === "Failed"
          ? "failed"
          : (data.scrape_status as string) === "Success"
            ? "full"
            : "partial";

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
      harvest_days:
        typeof rawHarvestDays === "number" && Number.isFinite(rawHarvestDays) ? rawHarvestDays : undefined,
    };

    const { error } = await admin.from("global_plant_cache").upsert(
      {
        source_url: url,
        identity_key: identityKey,
        vendor,
        extract_data: extractData,
        original_hero_url: heroUrl,
        scraped_fields: scrapedFields,
        scrape_quality: quality,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_url" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, identity_key: identityKey });
  } catch (e) {
    console.error("[re-extract-url]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Re-extract failed" },
      { status: 500 }
    );
  }
}
