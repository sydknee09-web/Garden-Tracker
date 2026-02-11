import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/garden/plant-profiles
 * Save master schedule config for a plant type (Learning Brain "DNA").
 * Body: { plant_type: string, sun?, plant_spacing?, sowing_method?, planting_window? }
 * Upserts one row per user per plant_type. Auth: Bearer token.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token =
    authHeader != null && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

  if (!token) {
    return NextResponse.json(
      { error: "Authorization required. Send Bearer <access_token>." },
      { status: 401 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json(
      { error: "Invalid or expired token." },
      { status: 401 }
    );
  }

  let body: {
    plant_type?: unknown;
    sun?: unknown;
    plant_spacing?: unknown;
    sowing_method?: unknown;
    planting_window?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const plantType =
    typeof body.plant_type === "string" && body.plant_type.trim()
      ? body.plant_type.trim()
      : null;

  if (!plantType) {
    return NextResponse.json(
      { error: "plant_type is required and must be a non-empty string." },
      { status: 400 }
    );
  }

  const row: Record<string, unknown> = {
    user_id: user.id,
    plant_type: plantType,
    updated_at: new Date().toISOString(),
  };

  if (typeof body.sun === "string") row.sun = body.sun.trim() || null;
  if (typeof body.plant_spacing === "string") row.plant_spacing = body.plant_spacing.trim() || null;
  if (typeof body.sowing_method === "string") row.sowing_method = body.sowing_method.trim() || null;
  if (typeof body.planting_window === "string") row.planting_window = body.planting_window.trim() || null;

  const { data, error } = await supabase
    .from("schedule_defaults")
    .upsert(row, {
      onConflict: "user_id,plant_type",
    })
    .select("id, plant_type, sun, plant_spacing, sowing_method, planting_window")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
