import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyZone10bToProfile } from "@/data/zone10b_schedule";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * For existing plant_profiles: where sun, plant_spacing, or days_to_germination
 * are empty, no digit, sentence-like, or (plant_spacing) contain "apart" or length > 20,
 * refill from ZONE_10B_SCHEDULE. Call with Bearer token. Returns { updated: number }.
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json(
      { error: "Invalid or expired token." },
      { status: 401 }
    );
  }

  const userId = user.id;

  const { data: profiles, error: fetchError } = await supabase
    .from("plant_profiles")
    .select("id, name, sun, plant_spacing, days_to_germination, harvest_days, sowing_method, planting_window")
    .eq("user_id", userId);

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message, updated: 0 },
      { status: 500 }
    );
  }

  const list = (profiles ?? []) as Array<{
    id: string;
    name: string;
    sun: string | null;
    plant_spacing: string | null;
    days_to_germination: string | null;
    harvest_days: number | null;
    sowing_method: string | null;
    planting_window: string | null;
  }>;

  let updated = 0;
  for (const profile of list) {
    const rawSpacing = profile.plant_spacing ?? null;
    const spacingDirty =
      rawSpacing != null &&
      (rawSpacing.length > 20 || /apart/i.test(rawSpacing));
    const merged = applyZone10bToProfile(profile.name.trim(), {
      sun: profile.sun ?? null,
      plant_spacing: spacingDirty ? null : rawSpacing,
      days_to_germination: profile.days_to_germination ?? null,
      harvest_days: profile.harvest_days ?? null,
    });

    const updates: Record<string, unknown> = {};
    if (merged.sun != null && merged.sun !== (profile.sun ?? "")) updates.sun = merged.sun;
    if (merged.plant_spacing != null && merged.plant_spacing !== (profile.plant_spacing ?? "")) updates.plant_spacing = merged.plant_spacing;
    if (merged.days_to_germination != null && merged.days_to_germination !== (profile.days_to_germination ?? "")) updates.days_to_germination = merged.days_to_germination;
    if (merged.harvest_days != null && merged.harvest_days !== (profile.harvest_days ?? null)) updates.harvest_days = merged.harvest_days;
    if (merged.sowing_method != null && merged.sowing_method !== (profile.sowing_method ?? "")) updates.sowing_method = merged.sowing_method;
    if (merged.planting_window != null && merged.planting_window !== (profile.planting_window ?? "")) updates.planting_window = merged.planting_window;

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase
        .from("plant_profiles")
        .update(updates)
        .eq("id", profile.id)
        .eq("user_id", userId);
      if (!updateErr) updated += 1;
    }
  }

  return NextResponse.json({ updated });
}
