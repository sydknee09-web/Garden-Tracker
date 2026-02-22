import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runBackfillCacheBatch } from "@/lib/backfillCacheBatch";
import { logApiUsageAsync } from "@/lib/logApiUsage";

export const maxDuration = 120;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const geminiKey = (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "").trim();

/**
 * POST: run one batch of global_plant_cache backfill (same logic as npm run backfill-cache).
 * Requires auth. Body: { offset?: number }. Returns { updated, skipped, failed, hasMore, nextOffset }.
 * Client can call in a loop with nextOffset until !hasMore.
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
