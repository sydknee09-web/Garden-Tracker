import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { looksLikeScientificName } from "@/lib/htmlEntities";

export const maxDuration = 120;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Refill scientific_name in global_plant_cache for rows that are missing it or have junk.
 * Uses Perenual API; query is identity_key with underscores replaced by spaces.
 * Requires auth. Writes via service role.
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
      return NextResponse.json({ error: "Server not configured (missing service role)" }, { status: 503 });
    }

    const { data: rows, error: fetchError } = await admin
      .from("global_plant_cache")
      .select("id, identity_key, extract_data")
      .not("identity_key", "is", null);

    if (fetchError || !rows?.length) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        skipped: 0,
        failed: 0,
        message: "No cache rows to process.",
      });
    }

    const needsScientific = rows.filter((row: { identity_key: string; extract_data?: Record<string, unknown> }) => {
      const key = (row.identity_key ?? "").trim();
      if (!key) return false;
      const ed = row.extract_data ?? {};
      const current = (ed.scientific_name as string) ?? "";
      if (!current.trim()) return true;
      return !looksLikeScientificName(current);
    }) as { id: string; identity_key: string; extract_data: Record<string, unknown> }[];

    if (needsScientific.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        skipped: rows.length,
        failed: 0,
        message: "No cache rows missing valid scientific name.",
      });
    }

    const base = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const origin = base.startsWith("http") ? base : `https://${base}`;
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of needsScientific) {
      const query = (row.identity_key ?? "").trim().replace(/_/g, " ");
      if (!query) {
        skipped++;
        continue;
      }

      try {
        const res = await fetch(
          `${origin}/api/seed/perenual-enrich?q=${encodeURIComponent(query)}`,
          { next: { revalidate: 0 }, headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          failed++;
          continue;
        }
        const data = (await res.json()) as { scientific_name?: string | null };
        const name = (data.scientific_name ?? "").trim();
        if (!name || !looksLikeScientificName(name)) {
          skipped++;
          continue;
        }

        const merged = { ...(row.extract_data ?? {}), scientific_name: name };
        const { error: updateError } = await admin
          .from("global_plant_cache")
          .update({
            extract_data: merged,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        if (updateError) {
          failed++;
        } else {
          updated++;
        }
      } catch {
        failed++;
      }

      await new Promise((r) => setTimeout(r, 350));
    }

    return NextResponse.json({
      ok: true,
      updated,
      skipped,
      failed,
      message: `Cache: refilled ${updated} scientific name(s). Skipped ${skipped}, failed ${failed}.`,
    });
  } catch (e) {
    console.error("Refill cache scientific names error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Refill failed." },
      { status: 500 }
    );
  }
}
