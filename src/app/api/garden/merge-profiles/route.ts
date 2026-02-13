import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/garden/merge-profiles
 * Merge source plant profiles into the target. Moves seed_packets and journal_entries to the target, then deletes source profiles.
 * Body: { targetProfileId: string, sourceProfileIds: string[] }
 * Auth: Bearer token.
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

  let body: { targetProfileId?: unknown; sourceProfileIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Send { targetProfileId, sourceProfileIds }." },
      { status: 400 }
    );
  }

  const targetProfileId =
    typeof body.targetProfileId === "string" ? body.targetProfileId.trim() : "";
  const rawSources = Array.isArray(body.sourceProfileIds)
    ? body.sourceProfileIds
    : [];

  const sourceProfileIds = rawSources
    .filter((id): id is string => typeof id === "string" && UUID_REGEX.test(id.trim()))
    .map((id) => id.trim());

  if (!UUID_REGEX.test(targetProfileId)) {
    return NextResponse.json(
      { error: "targetProfileId is required and must be a valid UUID." },
      { status: 400 }
    );
  }

  if (sourceProfileIds.length === 0) {
    return NextResponse.json(
      { error: "sourceProfileIds must be a non-empty array of UUIDs." },
      { status: 400 }
    );
  }

  if (sourceProfileIds.includes(targetProfileId)) {
    return NextResponse.json(
      { error: "Target profile cannot be in the source list." },
      { status: 400 }
    );
  }

  const sourceSet = new Set(sourceProfileIds);
  if (sourceSet.size !== sourceProfileIds.length) {
    return NextResponse.json(
      { error: "sourceProfileIds must not contain duplicates." },
      { status: 400 }
    );
  }

  const allIds = [targetProfileId, ...sourceProfileIds];

  const { data: profiles, error: fetchError } = await supabase
    .from("plant_profiles")
    .select("id, user_id")
    .in("id", allIds);

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message },
      { status: 500 }
    );
  }

  const found = (profiles ?? []) as { id: string; user_id: string }[];
  const ownProfileIds = new Set(found.filter((p) => p.user_id === userId).map((p) => p.id));

  if (!ownProfileIds.has(targetProfileId)) {
    return NextResponse.json(
      { error: "Target profile not found or you do not own it." },
      { status: 404 }
    );
  }

  const missingSources = sourceProfileIds.filter((id) => !ownProfileIds.has(id));
  if (missingSources.length > 0) {
    return NextResponse.json(
      { error: "One or more source profiles not found or you do not own them." },
      { status: 404 }
    );
  }

  let packetsMoved = 0;
  let journalMoved = 0;

  const { data: updatedPackets, error: packetsUpdateError } = await supabase
    .from("seed_packets")
    .update({ plant_profile_id: targetProfileId })
    .in("plant_profile_id", sourceProfileIds)
    .eq("user_id", userId)
    .select("id");

  if (packetsUpdateError) {
    return NextResponse.json(
      { error: `Failed to move seed packets: ${packetsUpdateError.message}` },
      { status: 500 }
    );
  }
  packetsMoved = updatedPackets?.length ?? 0;

  const { data: updatedJournal, error: journalUpdateError } = await supabase
    .from("journal_entries")
    .update({ plant_profile_id: targetProfileId })
    .in("plant_profile_id", sourceProfileIds)
    .eq("user_id", userId)
    .select("id");

  if (journalUpdateError) {
    return NextResponse.json(
      { error: `Failed to move journal entries: ${journalUpdateError.message}` },
      { status: 500 }
    );
  }
  journalMoved = updatedJournal?.length ?? 0;

  const now = new Date().toISOString();
  const { error: deleteError } = await supabase
    .from("plant_profiles")
    .update({ deleted_at: now })
    .in("id", sourceProfileIds)
    .eq("user_id", userId);

  if (deleteError) {
    return NextResponse.json(
      { error: `Merge completed but failed to delete source profiles: ${deleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    merged: true,
    targetProfileId,
    sourceProfileIds,
    packetsMoved,
    journalMoved,
    profilesDeleted: sourceProfileIds.length,
  });
}
