import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runBackfillPlantDescriptionsBatch } from "@/lib/backfillPlantDescriptionsBatch";

export const maxDuration = 120;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const geminiKey = (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "").trim();

/**
 * POST: run one batch of plant-descriptions backfill (same logic as npm run backfill-plant-descriptions).
 * Requires auth. Returns { fromCache, fromAi, failed, hasMore }. Client can call in a loop until !hasMore.
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

    const body = await req.json().catch(() => ({}));
    const batchSize = typeof body?.batchSize === "number" && body.batchSize > 0 ? Math.min(body.batchSize, 50) : 50;
    const dryRun = Boolean(body?.dryRun);

    const result = await runBackfillPlantDescriptionsBatch(admin, {
      batchSize,
      dryRun,
      geminiKey: geminiKey || undefined,
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
