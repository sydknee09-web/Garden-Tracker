import { NextResponse } from "next/server";
import { researchVariety } from "@/app/api/seed/extract/route";
import { logApiError } from "@/lib/apiErrorLog";
import { logApiUsageAsync } from "@/lib/logApiUsage";
import { getSupabaseUser } from "@/app/api/import/auth";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 30;

function parseCommaList(s: string | undefined): string[] | null {
  if (!s?.trim()) return null;
  const arr = s.split(",").map((x) => x.trim()).filter(Boolean);
  return arr.length > 0 ? arr : null;
}

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
  sowing_method?: string | null;
  planting_window?: string | null;
  water?: string | null;
  source_url?: string | null;
  plant_description?: string | null;
  growing_notes?: string | null;
  propagation_notes?: string | null;
  seed_saving_notes?: string | null;
  companion_plants?: string[] | null;
  avoid_plants?: string[] | null;
  mature_height?: string | null;
  mature_width?: string | null;
};

/** Enrich plant profile from name + variety only (no vendor in search). Used for store-bought new profiles. */
export async function POST(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const variety = typeof body?.variety === "string" ? body.variety.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const identityKey = identityKeyFromVariety(name, variety);

    // Botany brain: check global_plant_library before AI (fallback to AI if table missing or unreachable)
    if (auth?.supabase && identityKey) {
      try {
        const { data: libRow } = await auth.supabase
          .from("global_plant_library")
          .select("mature_height, mature_width, sun, water, spacing, germination_days, harvest_days, description")
          .eq("identity_key", identityKey)
          .maybeSingle();
        if (libRow) {
          const row = libRow as {
            mature_height?: string | null;
            mature_width?: string | null;
            sun?: string | null;
            water?: string | null;
            spacing?: string | null;
            germination_days?: string | null;
            harvest_days?: number | null;
            description?: string | null;
          };
          const response: EnrichFromNameResponse = {
            sun: row.sun?.trim() || null,
            plant_spacing: row.spacing?.trim() || null,
            days_to_germination: row.germination_days?.trim() || null,
            harvest_days: row.harvest_days ?? null,
            water: row.water?.trim() || null,
            plant_description: row.description?.trim() || null,
            growing_notes: null,
            mature_height: row.mature_height?.trim() || null,
            mature_width: row.mature_width?.trim() || null,
          };
          return NextResponse.json({ enriched: true, ...response } satisfies { enriched: true } & EnrichFromNameResponse);
        }
      } catch {
        // Table may not exist yet (migration not propagated); fall through to AI
      }
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
      sowing_method: result.sowing_method?.trim() || null,
      planting_window: result.planting_window?.trim() || null,
      water: result.water?.trim() || null,
      source_url: result.source_url?.trim() || null,
      plant_description: result.plant_description?.trim() || null,
      growing_notes: result.growing_notes?.trim() || null,
      propagation_notes: result.propagation_notes?.trim() || null,
      seed_saving_notes: result.seed_saving_notes?.trim() || null,
      companion_plants: parseCommaList(result.companion_plants),
      avoid_plants: parseCommaList(result.avoid_plants),
      mature_height: result.mature_height?.trim() || null,
      mature_width: result.mature_width?.trim() || null,
    };
    if (auth?.user?.id) {
      logApiUsageAsync({ userId: auth.user.id, provider: "gemini", operation: "enrich-from-name" });
    }

    // Upsert result into global_plant_library so the brain grows (service role only)
    const admin = getSupabaseAdmin();
    if (admin && identityKey) {
      try {
        await admin.from("global_plant_library").upsert(
          {
            identity_key: identityKey,
            mature_height: response.mature_height ?? null,
            mature_width: response.mature_width ?? null,
            sun: response.sun ?? null,
            water: response.water ?? null,
            spacing: response.plant_spacing ?? null,
            germination_days: response.days_to_germination ?? null,
            harvest_days: response.harvest_days ?? null,
            description: response.plant_description ?? response.growing_notes ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "identity_key" }
        );
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ enriched: true, ...response } satisfies { enriched: true } & EnrichFromNameResponse);
  } catch (e) {
    logApiError("enrich-from-name", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}
