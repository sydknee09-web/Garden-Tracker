import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeVendorKey } from "@/lib/vendorNormalize";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Persist a user-chosen hero URL to global_plant_cache so future imports and
 * other users get this vetted image. Called when the user picks an image from
 * the "Choose from web images" gallery on the plant profile page.
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

    const body = await req.json().catch(() => ({}));
    const identity_key = typeof body?.identity_key === "string" ? body.identity_key.trim() : "";
    const hero_image_url = typeof body?.hero_image_url === "string" ? body.hero_image_url.trim() : "";

    if (!identity_key) {
      return NextResponse.json({ error: "identity_key required" }, { status: 400 });
    }
    if (!hero_image_url || !hero_image_url.startsWith("http")) {
      return NextResponse.json({ error: "hero_image_url required and must be an http(s) URL" }, { status: 400 });
    }

    const name = typeof body?.name === "string" ? body.name.trim() : "Imported seed";
    const variety = typeof body?.variety === "string" ? body.variety.trim() : "";
    const vendor = typeof body?.vendor === "string" ? body.vendor.trim() : "";

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Server not configured for cache writes" }, { status: 503 });
    }

    const vendorNorm = normalizeVendorKey(vendor) || "default";

    // Same strategy as find-hero-photo: update existing row with null hero, else upsert synthetic row.
    const { data: existing } = await admin
      .from("global_plant_cache")
      .select("id")
      .eq("identity_key", identity_key)
      .is("original_hero_url", null)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (existing?.length && existing[0]?.id) {
      const { error: updateError } = await admin
        .from("global_plant_cache")
        .update({ original_hero_url: hero_image_url, updated_at: new Date().toISOString() })
        .eq("id", existing[0].id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const syntheticSourceUrl = `hero:${identity_key}:${vendorNorm}`;
      const { error: upsertError } = await admin.from("global_plant_cache").upsert(
        {
          source_url: syntheticSourceUrl,
          identity_key,
          vendor: vendor || null,
          original_hero_url: hero_image_url,
          extract_data: { type: name, variety, vendor },
          scraped_fields: ["hero"],
          scrape_quality: "user_hero",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source_url" }
      );
      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, identity_key });
  } catch (e) {
    console.error("[save-hero-to-cache]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Write failed" },
      { status: 500 }
    );
  }
}
