import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-only Supabase client with service role. Use for admin operations
 * (e.g. creating storage buckets). Do not expose to the client.
 */
export function getSupabaseAdmin() {
  if (!serviceRoleKey?.trim()) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}
