import { NextResponse } from "next/server";
import { getSupabaseUser, unauthorized } from "@/app/api/import/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST: Soft-delete orphan seed packets (packets whose plant_profile is deleted).
 * Uses service role to bypass RLS and update packets owned by any user.
 * Requires auth.
 */
export async function POST(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    if (!auth) return unauthorized();

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Server not configured (missing SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 503 }
      );
    }

    const { data: deletedProfileIds } = await admin
      .from("plant_profiles")
      .select("id")
      .not("deleted_at", "is", null);

    if (!deletedProfileIds?.length) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        message: "No deleted profiles found.",
      });
    }

    const profileIds = deletedProfileIds.map((r) => r.id);
    const { data: packetsToUpdate, error: selectErr } = await admin
      .from("seed_packets")
      .select("id")
      .is("deleted_at", null)
      .in("plant_profile_id", profileIds);

    if (selectErr) {
      return NextResponse.json({ error: selectErr.message }, { status: 500 });
    }

    const packetIds = (packetsToUpdate ?? []).map((r) => r.id);
    if (packetIds.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        message: "No orphan packets found.",
      });
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await admin
      .from("seed_packets")
      .update({ deleted_at: now })
      .in("id", packetIds);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      updated: packetIds.length,
      message: `Soft-deleted ${packetIds.length} orphan packet(s).`,
    });
  } catch (e) {
    console.error("[clean-orphan-packets]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
