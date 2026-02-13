import { NextResponse } from "next/server";
import { rescueFromUrl, getBlockedTagsForRequest, filterBlockedTags, cleanVarietyForDisplay, inferSpecificPlantFromVariety } from "../extract/route";
import type { ExtractResponse } from "../extract/route";

export const maxDuration = 30;

const SCRAPE_URL_TIMEOUT_MS = 22_000;

/** Pass 2: Rescue metadata — use canonical scrape-url first (same as Pass 1 / cache), then AI rescue. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const batchIndex = typeof body?.batchIndex === "number" ? body.batchIndex : undefined;
    const batchTotal = typeof body?.batchTotal === "number" ? body.batchTotal : undefined;
    const isFirstInBatch = body?.isFirstInBatch === true;

    if (!url) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    if (isFirstInBatch && batchTotal != null) {
      console.log(`[PASS 2] Rescuing ${batchTotal} failed links...`);
    }
    const batchLabel =
      batchTotal != null && batchIndex != null
        ? ` ${batchIndex + 1}/${batchTotal}`
        : "";
    console.log(`[PASS 2] Rescuing link${batchLabel}: ${url.slice(0, 60)}...`);

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (typeof process.env.VERCEL_URL === "string" ? `https://${process.env.VERCEL_URL}` : null) ||
      (() => {
        try {
          return new URL(req.url).origin;
        } catch {
          return "http://localhost:3000";
        }
      })();
    let result: ExtractResponse | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SCRAPE_URL_TIMEOUT_MS);
      const scrapeRes = await fetch(`${origin}/api/seed/scrape-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (scrapeRes.ok) {
        const data = (await scrapeRes.json().catch(() => null)) as Record<string, unknown> | null;
        if (data && !data.error) {
          const type = String(data.plant_name ?? data.type ?? "Imported seed").trim() || "Imported seed";
          const variety = String(data.variety_name ?? data.variety ?? "").trim();
          if (type !== "Imported seed" || variety) {
            result = {
              type,
              variety,
              vendor: String(data.vendor_name ?? data.vendor ?? "").trim() || "",
              tags: (Array.isArray(data.tags) ? data.tags : []) as string[],
              source_url: url,
              sowing_depth: data.sowing_depth as string | undefined,
              spacing: (data.spacing ?? data.plant_spacing) as string | undefined,
              sun_requirement: (data.sun_requirement ?? data.sun) as string | undefined,
              days_to_germination: data.days_to_germination as string | undefined,
              days_to_maturity: typeof data.harvest_days === "number" ? String(data.harvest_days) : undefined,
              scientific_name: data.scientific_name as string | undefined,
              plant_description: data.plant_description as string | undefined,
              hero_image_url: (data.hero_image_url ?? data.stock_photo_url ?? data.imageUrl) as string | undefined,
              stock_photo_url: (data.stock_photo_url ?? data.imageUrl) as string | undefined,
            };
          }
        }
      }
    } catch {
      // fall through to rescueFromUrl
    }

    if (!result) {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
      if (!apiKey) {
        return NextResponse.json(
          { error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" },
          { status: 503 }
        );
      }
      result = await rescueFromUrl(apiKey, url) ?? null;
      if (!result) {
        return NextResponse.json(
          { error: "Could not rescue data from URL" },
          { status: 422 }
        );
      }
    }

    const blocked = await getBlockedTagsForRequest(req);
    result.tags = filterBlockedTags(result.tags ?? [], blocked);
    if ((result.type ?? "").trim().toLowerCase() === "flower") {
      const specific = inferSpecificPlantFromVariety(result.variety ?? "");
      if (specific) result.type = specific;
    }
    const { cleanedVariety, tagsToAdd } = cleanVarietyForDisplay(result.variety ?? "", result.type ?? "");
    result.variety = cleanedVariety;
    if (tagsToAdd.length > 0) {
      result.tags = Array.from(new Set([...(result.tags ?? []), ...tagsToAdd]));
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[PASS 2] extract-rescue error:", e);
    const message = e instanceof Error ? e.message : "Rescue failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
