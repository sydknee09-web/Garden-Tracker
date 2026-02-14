import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { normalizeVendorKey } from "@/lib/vendorNormalize";

export const maxDuration = 120;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const IMAGE_CHECK_TIMEOUT_MS = 5_000;

/** Placeholder hero URL (generic icon). Treat as "no hero" so we try to find a real photo. */
function isPlaceholderHeroUrl(url: string | null | undefined): boolean {
  if (!url || !String(url).trim()) return false;
  const u = String(url).trim().toLowerCase();
  return u === "/seedling-icon.svg" || u.endsWith("/seedling-icon.svg");
}

function qualityRank(q: string): number {
  const rank: Record<string, number> = { full: 3, partial: 2, ai_only: 1, failed: 0 };
  return rank[q] ?? -1;
}

async function checkImageAccessible(url: string): Promise<boolean> {
  if (!url?.startsWith("http")) return false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), IMAGE_CHECK_TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** Parse "65" or "55-70" to number (first number). */
function parseHarvestDays(s: string | undefined): number | null {
  if (typeof s !== "string" || !s.trim()) return null;
  const first = s.trim().replace(/,/g, "").match(/^\d+/);
  const n = first ? parseInt(first[0], 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Fill in blanks: for profiles missing hero or metadata, look up global_plant_cache
 * by identity (free). Optionally use Gemini (find-hero-photo) for profiles still missing hero.
 * Does NOT use Tavily. Does NOT write to global_plant_cache.
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
    const useGemini = Boolean(body?.useGemini);

    // Profiles that need filling: missing hero (and optionally sparse metadata)
    const { data: profiles, error: profilesError } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, hero_image_url, hero_image_path, sun, plant_spacing, days_to_germination, harvest_days, scientific_name")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (profilesError || !profiles?.length) {
      return NextResponse.json({
        ok: true,
        fromCache: 0,
        fromAi: 0,
        failed: 0,
        skipped: 0,
        message: "No profiles to process.",
      });
    }

    // Missing hero = no uploaded hero_image_path and (no URL or only placeholder icon URL)
    const missingHero = (p: { hero_image_url?: string | null; hero_image_path?: string | null }) => {
      const path = (p.hero_image_path ?? "").trim();
      if (path) return false;
      const url = (p.hero_image_url ?? "").trim();
      if (!url) return true;
      return isPlaceholderHeroUrl(url);
    };

    // Metadata-sparse = missing most of sun, spacing, germination, harvest (so we try cache for "How to Grow")
    const metadataSparse = (p: { sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null }) => {
      const has = (v: string | number | null | undefined) => (v != null && String(v).trim() !== "" && (typeof v !== "number" || Number.isFinite(v)));
      const count = [p.sun, p.plant_spacing, p.days_to_germination, p.harvest_days].filter(has).length;
      return count < 2; // include if 0 or 1 of these set
    };

    // Include profile if missing hero OR has empty/sparse metadata (so cache lookup can fill About)
    const needFilling = profiles.filter(
      (p: { hero_image_url?: string | null; hero_image_path?: string | null; sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null }) =>
        missingHero(p) || metadataSparse(p)
    );

    if (needFilling.length === 0) {
      return NextResponse.json({
        ok: true,
        fromCache: 0,
        fromAi: 0,
        failed: 0,
        skipped: profiles.length,
        message: "No profiles missing hero or metadata.",
      });
    }

    const profileIds = needFilling.map((p: { id: string }) => p.id);
    const { data: packets } = await supabase
      .from("seed_packets")
      .select("plant_profile_id, vendor_name")
      .eq("user_id", user.id)
      .in("plant_profile_id", profileIds)
      .order("created_at", { ascending: true });

    const vendorByProfile: Record<string, string> = {};
    (packets ?? []).forEach((row: { plant_profile_id: string; vendor_name: string | null }) => {
      if (vendorByProfile[row.plant_profile_id] == null) {
        vendorByProfile[row.plant_profile_id] = (row.vendor_name ?? "").trim() || "";
      }
    });

    let fromCache = 0;
    let fromAi = 0;
    let failed = 0;

    for (const p of needFilling as Array<{
      id: string;
      name: string;
      variety_name: string | null;
      hero_image_url?: string | null;
      hero_image_path?: string | null;
      sun?: string | null;
      plant_spacing?: string | null;
      days_to_germination?: string | null;
      harvest_days?: number | null;
      scientific_name?: string | null;
    }>) {
      const name = (p.name ?? "").trim() || "Imported seed";
      const variety = (p.variety_name ?? "").trim();
      const identityKey = identityKeyFromVariety(name, variety);
      if (!identityKey) {
        failed++;
        continue;
      }

      const vendor = vendorByProfile[p.id] ?? "";
      const vendorKey = vendor ? normalizeVendorKey(vendor) : "";

      const { data: rows, error: cacheError } = await supabase
        .from("global_plant_cache")
        .select("id, extract_data, original_hero_url, vendor, scrape_quality, updated_at")
        .eq("identity_key", identityKey)
        .limit(10);

      if (cacheError || !rows?.length) {
        if (useGemini) {
          const heroUrl = await findHeroPhotoWithToken(token, name, variety, vendor, identityKey);
          if (heroUrl) {
            const { error: upErr } = await supabase
              .from("plant_profiles")
              .update({ hero_image_url: heroUrl })
              .eq("id", p.id)
              .eq("user_id", user.id);
            if (!upErr) fromAi++;
            else failed++;
          } else failed++;
        } else failed++;
        continue;
      }

      const filtered =
        vendorKey && rows.length > 1
          ? rows.filter((r: { vendor?: string | null }) => normalizeVendorKey((r.vendor ?? "")) === vendorKey)
          : rows;
      const toSort = filtered.length > 0 ? filtered : rows;
      const sorted = [...toSort].sort((a, b) => {
        const qA = qualityRank((a as { scrape_quality?: string }).scrape_quality ?? "");
        const qB = qualityRank((b as { scrape_quality?: string }).scrape_quality ?? "");
        if (qB !== qA) return qB - qA;
        const tA = new Date((a as { updated_at?: string }).updated_at ?? 0).getTime();
        const tB = new Date((b as { updated_at?: string }).updated_at ?? 0).getTime();
        return tB - tA;
      });
      const row = sorted[0] as { extract_data: Record<string, unknown>; original_hero_url?: string | null };
      const ed = row.extract_data ?? {};

      const heroFromRow =
        (row.original_hero_url as string)?.trim() ||
        (typeof ed.hero_image_url === "string" && ed.hero_image_url.trim()) ||
        "";
      let heroUrl = heroFromRow.startsWith("http") ? heroFromRow : "";
      if (heroUrl && !(await checkImageAccessible(heroUrl))) heroUrl = "";

      const updates: Record<string, unknown> = {};
      if (heroUrl) updates.hero_image_url = heroUrl;
      if (!(p.sun ?? "").trim() && typeof ed.sun_requirement === "string" && ed.sun_requirement.trim()) {
        updates.sun = (ed.sun_requirement as string).trim();
      }
      if (!(p.plant_spacing ?? "").trim() && typeof ed.spacing === "string" && ed.spacing.trim()) {
        updates.plant_spacing = (ed.spacing as string).trim();
      }
      if (!(p.days_to_germination ?? "").trim() && typeof ed.days_to_germination === "string" && ed.days_to_germination.trim()) {
        updates.days_to_germination = (ed.days_to_germination as string).trim();
      }
      const maturityStr = typeof ed.days_to_maturity === "string" ? ed.days_to_maturity : undefined;
      if ((p.harvest_days == null || p.harvest_days === 0) && maturityStr) {
        const parsed = parseHarvestDays(maturityStr);
        if (parsed != null) updates.harvest_days = parsed;
      }
      if (!(p.scientific_name ?? "").trim() && typeof ed.scientific_name === "string" && ed.scientific_name.trim()) {
        updates.scientific_name = (ed.scientific_name as string).trim();
      }

      if (Object.keys(updates).length === 0) {
        if (useGemini) {
          const aiHero = await findHeroPhotoWithToken(token, name, variety, vendor, identityKey);
          if (aiHero) {
            const { error: upErr } = await supabase
              .from("plant_profiles")
              .update({ hero_image_url: aiHero })
              .eq("id", p.id)
              .eq("user_id", user.id);
            if (!upErr) fromAi++;
            else failed++;
          } else failed++;
        } else failed++;
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
        fromCache++;
        // Cache had metadata but no usable hero; optionally fill hero via AI
        if (useGemini && !heroUrl) {
          const aiHero = await findHeroPhotoWithToken(token, name, variety, vendor, identityKey);
          if (aiHero) {
            const { error: upErr } = await supabase
              .from("plant_profiles")
              .update({ hero_image_url: aiHero })
              .eq("id", p.id)
              .eq("user_id", user.id);
            if (!upErr) fromAi++;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      fromCache,
      fromAi,
      failed,
      skipped: profiles.length - needFilling.length,
      message: `From cache: ${fromCache}. From AI: ${fromAi}. No match: ${failed}.`,
    });
  } catch (e) {
    console.error("[fill-in-blanks]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fill-in-blanks failed" },
      { status: 500 }
    );
  }
}

async function findHeroPhotoWithToken(
  token: string,
  name: string,
  variety: string,
  vendor: string,
  identityKey?: string
): Promise<string> {
  const base = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = base.startsWith("http") ? base : `https://${base}`;
  try {
    const res = await fetch(`${url}/api/seed/find-hero-photo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, variety, vendor, identity_key: identityKey ?? undefined }),
    });
    const data = (await res.json()) as { hero_image_url?: string };
    return (data.hero_image_url ?? "").trim();
  } catch {
    return "";
  }
}
