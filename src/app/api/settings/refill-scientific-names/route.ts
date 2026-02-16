import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { looksLikeScientificName } from "@/lib/htmlEntities";

export const maxDuration = 120;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Refill scientific_name for profiles that are missing it, using Perenual API.
 * Only updates when Perenual returns a value that looks like a real scientific name.
 * POST body: optional (no params required).
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const { data: profiles, error: profilesError } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, scientific_name")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (profilesError || !profiles?.length) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        skipped: 0,
        failed: 0,
        message: "No profiles to process.",
      });
    }

    const missingScientific = profiles.filter(
      (p: { scientific_name?: string | null }) => !(p.scientific_name ?? "").trim()
    ) as { id: string; name: string; variety_name: string | null }[];

    if (missingScientific.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        skipped: missingScientific.length,
        failed: 0,
        message: "No profiles missing scientific name.",
      });
    }

    const base = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const origin = base.startsWith("http") ? base : `https://${base}`;

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < missingScientific.length; i++) {
      const p = missingScientific[i]!;
      const query = [p.name, p.variety_name].filter(Boolean).join(" ").trim() || p.name;

      try {
        const res = await fetch(
          `${origin}/api/seed/perenual-enrich?q=${encodeURIComponent(query)}`,
          { next: { revalidate: 0 } }
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
        const { error: updateError } = await supabase
          .from("plant_profiles")
          .update({ scientific_name: name })
          .eq("id", p.id)
          .eq("user_id", user.id);
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
      message: `Refilled ${updated} scientific name(s). Skipped ${skipped}, failed ${failed}.`,
    });
  } catch (e) {
    console.error("Refill scientific names error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Refill failed." },
      { status: 500 }
    );
  }
}
