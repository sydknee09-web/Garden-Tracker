import { NextResponse } from "next/server";
import { getSupabaseUser, unauthorized } from "@/app/api/import/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runBackfillCacheBatch } from "@/lib/backfillCacheBatch";
import { logApiUsageAsync } from "@/lib/logApiUsage";

export const maxDuration = 120;

const geminiKey = (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "").trim();

/**
 * POST: run one batch of global_plant_cache backfill (same logic as npm run backfill-cache).
 * Requires auth. Body: { offset?: number }. Returns { updated, skipped, failed, hasMore, nextOffset }.
 * Client can call in a loop with nextOffset until !hasMore.
 */
export async function POST(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    if (!auth) return unauthorized();
    const { user } = auth;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Server not configured for backfill (missing service role)" }, { status: 503 });
    }

    if (!geminiKey) {
      return NextResponse.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY not set; cache backfill requires Gemini" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const offset = typeof body?.offset === "number" && body.offset >= 0 ? body.offset : 0;
    const batchSize = typeof body?.batchSize === "number" && body.batchSize > 0 ? Math.min(body.batchSize, 30) : 20;
    const dryRun = Boolean(body?.dryRun);

    const result = await runBackfillCacheBatch(admin, {
      batchSize,
      dryRun,
      geminiKey,
      offset,
      onGeminiCall: () => logApiUsageAsync({ userId: user.id, provider: "gemini", operation: "backfill-cache" }),
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[backfill-cache]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Backfill failed", updated: 0, skipped: 0, failed: 0, hasMore: false },
      { status: 500 }
    );
  }
}
