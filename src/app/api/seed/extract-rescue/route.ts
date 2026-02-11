import { NextResponse } from "next/server";
import { rescueFromUrl, getBlockedTagsForRequest, filterBlockedTags, cleanVarietyForDisplay, inferSpecificPlantFromVariety } from "../extract/route";
import type { ExtractResponse } from "../extract/route";

export const maxDuration = 30;

/** Pass 2: Rescue metadata using URL slug when Pass 1 returned failed. */
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

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" },
        { status: 503 }
      );
    }

    if (isFirstInBatch && batchTotal != null) {
      console.log(`[PASS 2] Rescuing ${batchTotal} failed links...`);
    }
    const batchLabel =
      batchTotal != null && batchIndex != null
        ? ` ${batchIndex + 1}/${batchTotal}`
        : "";
    console.log(`[PASS 2] Rescuing link${batchLabel}: ${url.slice(0, 60)}...`);

    const result = await rescueFromUrl(apiKey, url);
    if (!result) {
      return NextResponse.json(
        { error: "Could not rescue data from URL" },
        { status: 422 }
      );
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
