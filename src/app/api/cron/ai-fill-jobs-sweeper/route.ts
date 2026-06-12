import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 60;

/** Jobs stuck pending/running past this are dead invocations (function timeout/crash) — mark failed. */
const STALE_ACTIVE_MINUTES = 15;
/** Completed/failed job rows older than this are deleted (brief: 7-day cleanup). */
const RETENTION_DAYS = 7;

/**
 * Daily Vercel cron (vercel.json): hygiene for ai_fill_jobs. The worker is the
 * enqueue route's in-invocation continuation, NOT this cron — this only (a)
 * fails-out stale active rows so clients stop showing spinner state, and (b)
 * deletes completed/failed rows past retention. Service role: cleanup spans all
 * users and RLS has no delete policy by design.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }

  try {
    const staleCutoff = new Date(Date.now() - STALE_ACTIVE_MINUTES * 60 * 1000).toISOString();
    const { data: staled, error: staleError } = await admin
      .from("ai_fill_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        result_summary: { fieldsFilled: 0, notFound: false, enriched: false, error: "TIMEOUT" },
      })
      .in("status", ["pending", "running"])
      .lt("enqueued_at", staleCutoff)
      .select("id");
    if (staleError) console.error("ai-fill-jobs-sweeper: stale sweep failed:", staleError.message);

    const retentionCutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: deleted, error: deleteError } = await admin
      .from("ai_fill_jobs")
      .delete()
      .in("status", ["complete", "failed"])
      .lt("completed_at", retentionCutoff)
      .select("id");
    if (deleteError) console.error("ai-fill-jobs-sweeper: retention delete failed:", deleteError.message);

    return NextResponse.json({
      ok: !staleError && !deleteError,
      staled: staled?.length ?? 0,
      deleted: deleted?.length ?? 0,
    });
  } catch (e) {
    console.error("ai-fill-jobs-sweeper:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sweep failed" }, { status: 500 });
  }
}
