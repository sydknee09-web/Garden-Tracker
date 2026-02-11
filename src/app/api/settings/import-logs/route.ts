import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET /api/settings/import-logs — list import/heros-search logs (auth required). Includes hero_image_url and error_message for trace + Vault badge. */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Column names match seed_import_logs schema: status_code (not status), identity_key_generated, error_message, hero_image_url
    const { data, error } = await supabase
      .from("seed_import_logs")
      .select("id, created_at, url, vendor_name, status_code, identity_key_generated, error_message, hero_image_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.warn("[import-logs] GET failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ logs: data ?? [] });
  } catch (e) {
    console.error("[import-logs] GET error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/settings/import-logs — append one import/heros-search log (auth required). */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    const rawErrorMessage = typeof body?.error_message === "string" ? body.error_message.trim() : "";
    if (!rawErrorMessage) {
      return NextResponse.json({ error: "error_message required (mandatory diagnostic trace)" }, { status: 400 });
    }

    const hero_image_url =
      typeof body?.hero_image_url === "string" && body.hero_image_url.trim().startsWith("http")
        ? body.hero_image_url.trim()
        : null;

    // Default status_code to 0 so UI shows red error instead of dash when missing
    const status_code =
      typeof body?.status_code === "number" ? body.status_code : 0;

    const error_message = rawErrorMessage;

    const { error: insertError } = await supabase.from("seed_import_logs").insert({
      user_id: user.id,
      url,
      vendor_name: typeof body?.vendor_name === "string" ? body.vendor_name.trim() || null : null,
      status_code,
      identity_key_generated: typeof body?.identity_key_generated === "string" ? body.identity_key_generated.trim() || null : null,
      error_message,
      hero_image_url,
    });

    if (insertError) {
      console.warn("[import-logs] insert failed:", insertError.message);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[import-logs] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
