import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

const DB_CHECK_TIMEOUT_MS = 3000;

/**
 * GET /api/health — Public, no auth. For uptime monitors.
 * Returns 200 when app + Supabase are reachable; 503 when DB check fails or times out.
 * DB check uses Promise.race(3s) so we fail fast and don't hang the monitor.
 */
export async function GET() {
  const dbOk = await checkSupabaseWithTimeout();
  if (!dbOk) {
    return NextResponse.json(
      { ok: false, status: "degraded", db: "error" },
      { status: 503 }
    );
  }
  return NextResponse.json(
    { ok: true, status: "ok", db: "ok" },
    { status: 200 }
  );
}

async function checkSupabaseWithTimeout(): Promise<boolean> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DB check timeout")), DB_CHECK_TIMEOUT_MS)
    );
    await Promise.race([supabase.auth.getSession(), timeout]);
    return true;
  } catch {
    return false;
  }
}
