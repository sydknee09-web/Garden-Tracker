import { NextResponse } from "next/server";
import { getSupabaseUser, unauthorized } from "@/app/api/import/auth";

export const dynamic = "force-dynamic";

function startOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function startOfYear(d: Date): string {
  return `${d.getFullYear()}-01-01`;
}

/**
 * GET: return aggregated API usage for the authenticated user.
 * Returns counts by provider for this month, last month, and this year.
 */
export async function GET(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    if (!auth) return unauthorized();
    const { supabase, user } = auth;

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = startOfMonth(lastMonth);
    const thisYearStart = startOfYear(now);

    const { data: rows, error } = await supabase
      .from("api_usage_log")
      .select("provider, operation, created_at, tokens")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (rows ?? []) as Array<{
      provider: string;
      operation: string;
      created_at: string;
      tokens: number | null;
    }>;

    const byProvider: Record<
      string,
      { thisMonth: number; lastMonth: number; thisYear: number; tokensThisMonth: number; tokensThisYear: number }
    > = {
      gemini: { thisMonth: 0, lastMonth: 0, thisYear: 0, tokensThisMonth: 0, tokensThisYear: 0 },
      openai: { thisMonth: 0, lastMonth: 0, thisYear: 0, tokensThisMonth: 0, tokensThisYear: 0 },
      perenual: { thisMonth: 0, lastMonth: 0, thisYear: 0, tokensThisMonth: 0, tokensThisYear: 0 },
    };

    for (const r of list) {
      const p = byProvider[r.provider];
      if (!p) continue;
      const ts = r.created_at.slice(0, 10);
      const tokens = r.tokens ?? 0;
      if (ts >= thisMonthStart) {
        p.thisMonth++;
        p.tokensThisMonth += tokens;
      }
      if (ts >= lastMonthStart && ts < thisMonthStart) {
        p.lastMonth++;
      }
      if (ts >= thisYearStart) {
        p.thisYear++;
        p.tokensThisYear += tokens;
      }
    }

    return NextResponse.json({
      byProvider,
      note: "Self-tracked from this app. For exact billing, check each provider's dashboard.",
    });
  } catch (e) {
    console.error("[usage]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch usage" },
      { status: 500 }
    );
  }
}
