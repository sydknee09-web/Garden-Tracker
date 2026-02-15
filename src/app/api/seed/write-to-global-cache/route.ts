import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Write one link-import result to global_plant_cache so other users benefit.
 * Called from review-import Save All when the item was not from cache (scrape or rescue succeeded).
 * Uses service role; requires authenticated user.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }

    const anon = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await anon.auth.getUser(token);
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Server not configured for cache writes" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const source_url = typeof body?.source_url === "string" ? body.source_url.trim() : "";
    if (!source_url || !source_url.startsWith("http")) {
      return NextResponse.json({ error: "source_url required (must start with http)" }, { status: 400 });
    }

    const type = (typeof body?.type === "string" ? body.type.trim() : "") || "Imported seed";
    const variety = (typeof body?.variety === "string" ? body.variety.trim() : "") || "";
    const identityKey = identityKeyFromVariety(type, variety);
    if (!identityKey) {
      return NextResponse.json({ error: "type and variety required for identity_key" }, { status: 400 });
    }

    const vendor = typeof body?.vendor === "string" ? body.vendor.trim() : undefined;
    const hero_image_url = typeof body?.hero_image_url === "string" ? body.hero_image_url.trim() : undefined;
    const extract_data: Record<string, unknown> = {
      type,
      variety,
      vendor: vendor ?? "",
      source_url,
      tags: Array.isArray(body?.tags) ? (body.tags as string[]).filter((t) => typeof t === "string") : [],
      sowing_depth: typeof body?.sowing_depth === "string" ? body.sowing_depth.trim() || undefined : undefined,
      spacing: typeof body?.spacing === "string" ? body.spacing.trim() || undefined : undefined,
      sun_requirement: typeof body?.sun_requirement === "string" ? body.sun_requirement.trim() || undefined : undefined,
      days_to_germination: typeof body?.days_to_germination === "string" ? body.days_to_germination.trim() || undefined : undefined,
      days_to_maturity: typeof body?.days_to_maturity === "string" ? body.days_to_maturity.trim() || undefined : undefined,
      scientific_name: typeof body?.scientific_name === "string" ? body.scientific_name.trim() || undefined : undefined,
      plant_description: typeof body?.plant_description === "string" ? body.plant_description.trim() || undefined : undefined,
      growing_notes: typeof body?.growing_notes === "string" ? body.growing_notes.trim() || undefined : undefined,
      hero_image_url: hero_image_url?.startsWith("http") ? hero_image_url : undefined,
      water: typeof body?.water === "string" ? body.water.trim() || undefined : undefined,
      sun: typeof body?.sun === "string" ? body.sun.trim() || undefined : undefined,
      plant_spacing: typeof body?.plant_spacing === "string" ? body.plant_spacing.trim() || undefined : undefined,
      sowing_method: typeof body?.sowing_method === "string" ? body.sowing_method.trim() || undefined : undefined,
      planting_window: typeof body?.planting_window === "string" ? body.planting_window.trim() || undefined : undefined,
    };
    const scraped_fields = Object.keys(extract_data).filter((k) => extract_data[k] != null && extract_data[k] !== "");
    const { error } = await admin.from("global_plant_cache").upsert(
      {
        source_url,
        identity_key: identityKey,
        vendor: vendor ?? null,
        extract_data,
        original_hero_url: hero_image_url?.startsWith("http") ? hero_image_url : null,
        scraped_fields,
        scrape_quality: "user_import",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_url" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, identity_key: identityKey });
  } catch (e) {
    console.error("[write-to-global-cache]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Write failed" },
      { status: 500 }
    );
  }
}
