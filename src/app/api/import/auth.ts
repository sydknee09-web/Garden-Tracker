import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

export function unauthorized() {
  return NextResponse.json({ error: "Authorization required. Send Bearer <access_token>." }, { status: 401 });
}

export async function getSupabaseUser(
  request: Request
): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { supabase, user };
}
