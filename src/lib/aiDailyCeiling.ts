/**
 * Durable per-user-per-day ceiling on Gemini usage, counted against api_usage_log.
 *
 * The in-process limiter (rateLimit.ts) only catches bursts on the same warm lambda;
 * on Vercel each invocation can be a fresh instance with its own empty Map, so it
 * provides no global ceiling (AI usage leak audit 2026-06-10, Leak 3). This check
 * reads the table that logApiUsage already writes, so a user's total daily spend is
 * bounded no matter how many lambda instances serve them.
 *
 * Fails OPEN (allows) when the admin client or the count query is unavailable —
 * the ceiling is a cost backstop, not an auth gate, and must never take AI features
 * down because observability infra hiccuped.
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logApiUsageAsync } from "@/lib/logApiUsage";

/** Default per-user-per-day Gemini call ceiling. Override via GEMINI_DAILY_LIMIT_PER_USER. */
export const DEFAULT_DAILY_LIMIT = 100;

/**
 * Operations excluded from the daily count: dev-tool batch runs (manually triggered,
 * would otherwise consume the owner's interactive quota) and the cap-hit marker rows
 * this module writes (excluding them prevents a feedback loop where being blocked
 * keeps you blocked).
 */
export const EXCLUDED_OPERATIONS = [
  "backfill-cache",
  "backfill-plant-descriptions",
  "daily-cap-hit",
];

export type DailyCeilingResult = {
  allowed: boolean;
  /** Gemini calls counted so far today (UTC); null when the check failed open. */
  used: number | null;
  limit: number;
};

/** Per-user daily limit; env-overridable. Falls back to default on missing/invalid values. */
export function getDailyLimit(): number {
  const raw = (process.env.GEMINI_DAILY_LIMIT_PER_USER ?? "").trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT;
}

/** Comma-separated user IDs exempt from the ceiling (owner/dev accounts). */
export function getDailyLimitAllowlist(): Set<string> {
  const raw = (process.env.GEMINI_DAILY_LIMIT_ALLOWLIST ?? "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

/** Start of the current UTC day as ISO string (the counting window). */
function startOfUtcDayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/**
 * Check the durable per-user-per-day Gemini ceiling. Call AFTER any free cache tiers
 * and immediately BEFORE the Gemini egress, so cache hits stay free under the cap.
 * Logs one `daily-cap-hit` audit row per blocked attempt (visible in the dev dashboard).
 */
export async function checkDailyAiCeiling(userId: string): Promise<DailyCeilingResult> {
  const limit = getDailyLimit();
  if (!userId || getDailyLimitAllowlist().has(userId)) {
    return { allowed: true, used: null, limit };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { allowed: true, used: null, limit };

  try {
    let query = admin
      .from("api_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("provider", "gemini")
      .gte("created_at", startOfUtcDayIso());
    for (const op of EXCLUDED_OPERATIONS) {
      query = query.neq("operation", op);
    }
    const { count, error } = await query;
    if (error || count == null) {
      if (error) console.error("checkDailyAiCeiling: count query failed:", error.message);
      return { allowed: true, used: null, limit };
    }

    if (count >= limit) {
      logApiUsageAsync({
        userId,
        provider: "gemini",
        operation: "daily-cap-hit",
        metadata: { limit, used: count },
      });
      return { allowed: false, used: count, limit };
    }
    return { allowed: true, used: count, limit };
  } catch (e) {
    console.error("checkDailyAiCeiling: check failed:", e instanceof Error ? e.message : e);
    return { allowed: true, used: null, limit };
  }
}
