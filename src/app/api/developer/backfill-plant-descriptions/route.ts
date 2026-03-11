import { NextResponse } from "next/server";
import { getSupabaseUser, unauthorized } from "@/app/api/import/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runBackfillPlantDescriptionsBatch } from "@/lib/backfillPlantDescriptionsBatch";
import { logApiUsageAsync } from "@/lib/logApiUsage";

export const maxDuration = 120;

const geminiKey = (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "").trim();

/**
 * POST: run one batch of plant-descriptions backfill (same logic as npm run backfill-plant-descriptions).
 * Requires auth. Returns { fromCache, fromAi, failed, hasMore }. Client can call in a loop until !hasMore.
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

    const body = await req.json().catch(() => ({}));
    const batchSize = typeof body?.batchSize === "number" && body.batchSize > 0 ? Math.min(body.batchSize, 50) : 50;
    const dryRun = Boolean(body?.dryRun);

    const result = await runBackfillPlantDescriptionsBatch(admin, {
      batchSize,
      dryRun,
      geminiKey: geminiKey || undefined,
      onGeminiCall: () => logApiUsageAsync({ userId: user.id, provider: "gemini", operation: "backfill-plant-descriptions" }),
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[backfill-plant-descriptions]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Backfill failed", fromCache: 0, fromAi: 0, failed: 0, hasMore: false },
      { status: 500 }
    );
  }
}
