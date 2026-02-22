/**
 * Log API usage for billing/limits visibility. Fire-and-forget; never throws.
 * Uses admin client so inserts bypass RLS.
 */
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type ApiUsageProvider = "gemini" | "openai" | "perenual";

export async function logApiUsage(params: {
  userId: string;
  provider: ApiUsageProvider;
  operation: string;
  tokens?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return;

    await admin.from("api_usage_log").insert({
      user_id: params.userId,
      provider: params.provider,
      operation: params.operation,
      tokens: params.tokens ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (e) {
    console.error("logApiUsage failed:", e);
  }
}

/**
 * Fire-and-forget wrapper. Call without awaiting; errors are logged internally.
 */
export function logApiUsageAsync(params: {
  userId: string;
  provider: ApiUsageProvider;
  operation: string;
  tokens?: number;
  metadata?: Record<string, unknown>;
}): void {
  void logApiUsage(params).catch((e) => console.error("logApiUsage failed:", e));
}
