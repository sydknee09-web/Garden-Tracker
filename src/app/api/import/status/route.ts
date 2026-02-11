import { NextResponse } from "next/server";
import { getSupabaseUser, unauthorized } from "../auth";

export const dynamic = "force-dynamic";

/** GET /api/import/status — active batch progress and ready-for-review count. */
export async function GET(request: Request) {
  const auth = await getSupabaseUser(request);
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  const { data: batches } = await supabase
    .from("pending_import_batches")
    .select("id, status, total_count, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const readyBatches = (batches ?? []).filter((b) => (b as { status: string }).status === "ready");
  const activeBatch = (batches ?? []).find(
    (b) => (b as { status: string }).status === "pending" || (b as { status: string }).status === "processing"
  ) as { id: string; status: string; total_count: number } | undefined;

  let readyCount = 0;
  let processedCount = 0;
  if (activeBatch) {
    const { count } = await supabase
      .from("pending_import_items")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", activeBatch.id)
      .eq("status", "ready");
    processedCount = count ?? 0;
  }
  for (const b of readyBatches) {
    const { count } = await supabase
      .from("pending_import_items")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", (b as { id: string }).id)
      .eq("status", "ready");
    readyCount += count ?? 0;
  }

  return NextResponse.json({
    activeBatch: activeBatch
      ? {
          batchId: activeBatch.id,
          status: activeBatch.status,
          processedCount,
          totalCount: activeBatch.total_count,
        }
      : null,
    readyCount,
  });
}
