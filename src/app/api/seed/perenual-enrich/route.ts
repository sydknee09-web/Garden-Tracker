import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logApiUsageAsync } from "@/lib/logApiUsage";

const PERENUAL_BASE = "https://perenual.com/api/v2";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type PerenualEnrichResult = {
  perenual_id: number;
  scientific_name: string | null;
  botanical_care_notes: {
    sunlight?: string[];
    watering?: string;
    cycle?: string;
    description?: string;
    [key: string]: unknown;
  };
};

/**
 * GET /api/seed/perenual-enrich?q=Tomato
 * Search Perenual by common name; fetch first result details. Returns perenual_id, scientific_name, botanical_care_notes.
 * Requires PERENUAL_API_KEY in env.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  let userId: string | null = null;
  if (token) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id ?? null;
  }

  const key = process.env.PERENUAL_API_KEY;
  if (!key?.trim()) {
    return NextResponse.json({ error: "Perenual API key not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Query parameter 'q' (common name) is required." }, { status: 400 });
  }

  try {
    const listRes = await fetch(
      `${PERENUAL_BASE}/species-list?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&per_page=1`,
      { next: { revalidate: 0 } }
    );
    if (!listRes.ok) {
      return NextResponse.json(
        { error: `Perenual list returned ${listRes.status}.` },
        { status: 502 }
      );
    }
    const listData = (await listRes.json()) as { data?: { id: number }[] };
    const first = listData.data?.[0];
    if (!first?.id) {
      return NextResponse.json(null);
    }

    const detailsRes = await fetch(
      `${PERENUAL_BASE}/species/details/${first.id}?key=${encodeURIComponent(key)}`,
      { next: { revalidate: 0 } }
    );
    if (!detailsRes.ok) {
      return NextResponse.json(
        { error: `Perenual details returned ${detailsRes.status}.` },
        { status: 502 }
      );
    }
    const details = (await detailsRes.json()) as {
      id: number;
      scientific_name?: string[] | string | null;
      sunlight?: string[];
      watering?: string;
      cycle?: string;
      description?: string;
      [key: string]: unknown;
    };

    const scientificName = Array.isArray(details.scientific_name)
      ? details.scientific_name[0] ?? null
      : typeof details.scientific_name === "string"
        ? details.scientific_name
        : null;

    const botanical_care_notes: PerenualEnrichResult["botanical_care_notes"] = {};
    if (Array.isArray(details.sunlight) && details.sunlight.length) botanical_care_notes.sunlight = details.sunlight;
    if (details.watering) botanical_care_notes.watering = details.watering;
    if (details.cycle) botanical_care_notes.cycle = details.cycle;
    if (details.description) botanical_care_notes.description = details.description;

    const result: PerenualEnrichResult = {
      perenual_id: details.id,
      scientific_name: scientificName ?? null,
      botanical_care_notes,
    };
    if (userId) logApiUsageAsync({ userId, provider: "perenual", operation: "perenual-enrich" });
    return NextResponse.json(result);
  } catch (e) {
    console.error("Perenual enrich error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Perenual request failed." },
      { status: 502 }
    );
  }
}
