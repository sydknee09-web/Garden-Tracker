import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { looksLikeScientificName } from "@/lib/htmlEntities";

export const maxDuration = 120;

const PERENUAL_BASE = "https://perenual.com/api/v2";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Fix plant profiles that use scientific names as the display "name" (e.g. from GeoSeed import).
 * For each profile where name + first segment of variety form a binomial:
 * - Look up Perenual by that binomial (search works for scientific names).
 * - If Perenual returns a common_name, set name = common_name and scientific_name = Perenual scientific_name.
 * - If no common name found, just set scientific_name = binomial so we at least store it.
 * POST: optional body. Requires PERENUAL_API_KEY.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }

    const key = process.env.PERENUAL_API_KEY?.trim();
    if (!key) {
      return NextResponse.json({ error: "PERENUAL_API_KEY not configured." }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    type Row = { id: string; name: string; variety_name: string | null; scientific_name: string | null };
    const toFix: Row[] = [];
    for (const p of profiles as Row[]) {
      const varietyPart = (p.variety_name ?? "").trim();
      const firstSegment = varietyPart.split(/\s*[-–—]\s*/)[0]?.trim() ?? "";
      const binomial = `${p.name} ${firstSegment}`.trim();
      if (!firstSegment || !looksLikeScientificName(binomial)) continue;
      toFix.push(p);
    }

    if (toFix.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        skipped: 0,
        failed: 0,
        message: "No profiles with scientific-name-as-display-name (name + variety = binomial) found.",
      });
    }

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < toFix.length; i++) {
      const p = toFix[i]!;
      const varietyPart = (p.variety_name ?? "").trim();
      const firstSegment = varietyPart.split(/\s*[-–—]\s*/)[0]?.trim() ?? "";
      const binomial = `${p.name} ${firstSegment}`.trim();

      try {
        const listRes = await fetch(
          `${PERENUAL_BASE}/species-list?key=${encodeURIComponent(key)}&q=${encodeURIComponent(binomial)}&per_page=1`,
          { next: { revalidate: 0 } }
        );
        if (!listRes.ok) {
          failed++;
          continue;
        }
        const listData = (await listRes.json()) as {
          data?: { common_name?: string | null; scientific_name?: string | string[] | null }[];
        };
        const first = listData.data?.[0];
        const commonName = (first?.common_name ?? "").trim();
        const sciNameRaw = first?.scientific_name;
        const sciName = (Array.isArray(sciNameRaw) ? sciNameRaw[0] : sciNameRaw) ?? "";
        const sciNameTrimmed = typeof sciName === "string" ? sciName.trim() : "";

        const updates: { name?: string; scientific_name?: string } = {};
        if (sciNameTrimmed && looksLikeScientificName(sciNameTrimmed)) {
          updates.scientific_name = sciNameTrimmed;
        } else {
          updates.scientific_name = binomial;
        }
        if (commonName && commonName.length > 0 && commonName.length <= 200) {
          updates.name = commonName;
        }

        if (Object.keys(updates).length === 0) {
          skipped++;
          continue;
        }

        const { error: updateError } = await supabase
          .from("plant_profiles")
          .update(updates)
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
      message: `Fixed ${updated} profile(s): display name → common name where found, scientific_name set. Skipped ${skipped}, failed ${failed}.`,
    });
  } catch (e) {
    console.error("Fix scientific display names error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fix failed." },
      { status: 500 }
    );
  }
}
