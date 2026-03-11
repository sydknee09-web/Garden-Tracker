import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/env";

/**
 * Server-only Supabase client with service role. Use for admin operations
 * (e.g. creating storage buckets). Do not expose to the client.
 */
export function getSupabaseAdmin() {
  const key = getSupabaseServiceRoleKey();
  if (!key) return null;
  const { url } = getSupabaseEnv();
  return createClient(url, key, { auth: { persistSession: false } });
}
