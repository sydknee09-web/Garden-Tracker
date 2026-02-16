import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { stripHtmlForDisplay } from "@/lib/htmlEntities";
import { normalizeVendorKey } from "@/lib/vendorNormalize";
import type { ExtractResponse } from "@/app/api/seed/extract/route";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const IMAGE_CHECK_TIMEOUT_MS = 5_000;

/** Check if image URL is accessible (200). Returns false for 403 or other non-2xx. */
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

/** Prefer full > partial > ai_only > failed. */
const QUALITY_RANK: Record<string, number> = { full: 3, partial: 2, ai_only: 1, failed: 0 };
function qualityRank(q: string): number {
  return QUALITY_RANK[q] ?? -1;
}

/**
 * Look up global_plant_cache by normalized identity (and optional vendor).
 * Returns ExtractResponse-shaped payload so photo flow can use it as a cache hit and skip AI.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const variety = typeof body?.variety === "string" ? body.variety.trim() : "";
    const vendor = typeof body?.vendor === "string" ? body.vendor.trim() : undefined;

    const identityKey = identityKeyFromVariety(name || "Imported seed", variety);
    if (!identityKey) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

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

    const { data: rows, error } = await supabase
      .from("global_plant_cache")
      .select("id, extract_data, original_hero_url, vendor, scrape_quality, updated_at")
      .eq("identity_key", identityKey)
      .limit(10);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!rows?.length) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    const vendorKey = vendor ? normalizeVendorKey(vendor) : "";
    const filtered =
      vendorKey && rows.length > 1
        ? rows.filter((r) => normalizeVendorKey((r as { vendor?: string | null }).vendor ?? "") === vendorKey)
        : rows;
    const toSort = filtered.length > 0 ? filtered : rows;

    // Order by quality then recency (full > partial > ai_only > failed, then updated_at desc)
    const sorted = [...toSort].sort((a, b) => {
      const qA = qualityRank((a as { scrape_quality?: string }).scrape_quality ?? "");
      const qB = qualityRank((b as { scrape_quality?: string }).scrape_quality ?? "");
      if (qB !== qA) return qB - qA;
      const tA = new Date((a as { updated_at?: string }).updated_at ?? 0).getTime();
      const tB = new Date((b as { updated_at?: string }).updated_at ?? 0).getTime();
      return tB - tA;
    });
    const row = sorted[0] as {
      extract_data: Record<string, unknown>;
      original_hero_url?: string | null;
      vendor?: string | null;
    };

    const ed = row.extract_data ?? {};
    const heroFromRow =
      (row.original_hero_url as string)?.trim() ||
      (typeof ed.hero_image_url === "string" && ed.hero_image_url.trim()) ||
      "";
    let heroUrl = heroFromRow.startsWith("http") ? heroFromRow : "";
    if (heroUrl && !(await checkImageAccessible(heroUrl))) {
      heroUrl = "";
    }

    const rawType = typeof ed.type === "string" ? ed.type : "Imported seed";
    const rawVariety = typeof ed.variety === "string" ? ed.variety : "";
    const rawScientific = typeof ed.scientific_name === "string" ? ed.scientific_name : "";
    const payload: ExtractResponse & { found: true } = {
      found: true,
      vendor: typeof ed.vendor === "string" ? ed.vendor : (row.vendor as string) ?? "",
      type: stripHtmlForDisplay(rawType) || "Imported seed",
      variety: stripHtmlForDisplay(rawVariety),
      tags: Array.isArray(ed.tags) ? (ed.tags as string[]).filter((t) => typeof t === "string") : [],
      sowing_depth: typeof ed.sowing_depth === "string" ? ed.sowing_depth : undefined,
      spacing: typeof ed.spacing === "string" ? ed.spacing : undefined,
      sun_requirement: typeof ed.sun_requirement === "string" ? ed.sun_requirement : undefined,
      days_to_germination: typeof ed.days_to_germination === "string" ? ed.days_to_germination : undefined,
      days_to_maturity: typeof ed.days_to_maturity === "string" ? ed.days_to_maturity : undefined,
      source_url: typeof ed.source_url === "string" ? ed.source_url : undefined,
      scientific_name: stripHtmlForDisplay(rawScientific) || undefined,
      plant_description: typeof ed.plant_description === "string" ? ed.plant_description : undefined,
      hero_image_url: heroUrl || undefined,
      stock_photo_url: heroUrl || undefined,
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[lookup-by-identity]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lookup failed" },
      { status: 500 }
    );
  }
}
