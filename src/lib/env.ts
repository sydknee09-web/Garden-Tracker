/**
 * Centralized env for API/server. Throws when called if required vars are missing.
 * Use in API routes and auth so failures are explicit instead of runtime null/undefined.
 */

function getRequired(name: string): string {
  const value = process.env[name];
  if (value == null || String(value).trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function getOptional(name: string): string | undefined {
  const value = process.env[name];
  if (value == null || String(value).trim() === "") return undefined;
  return value.trim();
}

/** Supabase URL and anon key (required for API auth and user-scoped client). */
export function getSupabaseEnv(): { url: string; anonKey: string } {
  return {
    url: getRequired("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

/** Service role key (optional; only needed for routes that bypass RLS, e.g. invite, backfill). */
export function getSupabaseServiceRoleKey(): string | undefined {
  return getOptional("SUPABASE_SERVICE_ROLE_KEY");
}
