import { NextResponse } from "next/server";
import { researchVariety } from "@/app/api/seed/extract/route";
import { logApiError } from "@/lib/apiErrorLog";

export const maxDuration = 30;

/** Parse "65" or "55-70" to a number (use first number). */
function parseDaysToMaturity(s: string | undefined): number | null {
  if (!s?.trim()) return null;
  const match = s.trim().match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export type EnrichFromNameResponse = {
  sun?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
  sowing_depth?: string | null;
  source_url?: string | null;
  plant_description?: string | null;
  growing_notes?: string | null;
};

/** Enrich plant profile from name + variety only (no vendor in search). Used for store-bought new profiles. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const variety = typeof body?.variety === "string" ? body.variety.trim() : "";
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

    // Search with name + variety only (no vendor) for better results
    const result = await researchVariety(apiKey, name, variety, "");
    if (!result) {
      return NextResponse.json({ enriched: false } satisfies { enriched: false });
    }

    const harvestDays = parseDaysToMaturity(result.days_to_maturity);
    const response: EnrichFromNameResponse = {
      sun: result.sun_requirement?.trim() || null,
      plant_spacing: result.spacing?.trim() || null,
      days_to_germination: result.days_to_germination?.trim() || null,
      harvest_days: harvestDays,
      sowing_depth: result.sowing_depth?.trim() || null,
      source_url: result.source_url?.trim() || null,
      plant_description: result.plant_description?.trim() || null,
      growing_notes: result.growing_notes?.trim() || null,
    };
    return NextResponse.json({ enriched: true, ...response } satisfies { enriched: true } & EnrichFromNameResponse);
  } catch (e) {
    logApiError("enrich-from-name", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}
