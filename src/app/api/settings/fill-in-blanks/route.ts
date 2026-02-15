import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { getCanonicalKey } from "@/lib/canonicalKey";
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

/** Pick best cache row by scrape_quality then updated_at. */
function pickBestCacheRow<T extends { scrape_quality?: string; updated_at?: string }>(rows: T[]): T | null {
  if (!rows?.length) return null;
  const sorted = [...rows].sort((a, b) => {
    const qA = qualityRank((a.scrape_quality ?? "").trim());
    const qB = qualityRank((b.scrape_quality ?? "").trim());
    if (qB !== qA) return qB - qA;
    const tA = new Date(a.updated_at ?? 0).getTime();
    const tB = new Date(b.updated_at ?? 0).getTime();
    return tB - tA;
  });
  return sorted[0] ?? null;
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

type CacheRow = { extract_data: Record<string, unknown>; original_hero_url?: string | null; vendor?: string | null; scrape_quality?: string; updated_at?: string };

/** Build updates (metadata + hero) from a cache row. Never replace existing data — only fills empty profile fields. Hero URL is checked for accessibility. */
async function buildUpdatesFromCacheRow(
  p: { sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null; scientific_name?: string | null; plant_description?: string | null; growing_notes?: string | null; hero_image_url?: string | null; hero_image_path?: string | null },
  row: CacheRow
): Promise<Record<string, unknown>> {
  const ed = row.extract_data ?? {};
  const updates: Record<string, unknown> = {};
  const heroFromRow =
    (row.original_hero_url as string)?.trim() ||
    (typeof ed.hero_image_url === "string" && ed.hero_image_url.trim()) ||
    "";
  let heroUrl = heroFromRow.startsWith("http") ? heroFromRow : "";
  if (heroUrl && !(await checkImageAccessible(heroUrl))) heroUrl = "";
  const currentUrl = (p.hero_image_url ?? "").trim();
  if (heroUrl && !(p.hero_image_path ?? "").trim() && (!currentUrl || isPlaceholderHeroUrl(currentUrl))) {
    updates.hero_image_url = heroUrl;
  }
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
  if (!(p.plant_description ?? "").trim() && typeof ed.plant_description === "string" && ed.plant_description.trim()) {
    updates.plant_description = (ed.plant_description as string).trim();
    updates.description_source = "vendor";
  }
  if (!(p.growing_notes ?? "").trim() && typeof ed.growing_notes === "string" && ed.growing_notes.trim()) {
    updates.growing_notes = (ed.growing_notes as string).trim();
    if (!updates.description_source) updates.description_source = "vendor";
  }
  return updates;
}

/**
 * Fill in blanks: for profiles missing hero, metadata, or plant_description, look up
 * global_plant_cache. Never replace existing data — only fill empty fields.
 * Lookup order: 0) link (cache by purchase_url/source_url), 1) vendor+variety+plant,
 * 2) variety+plant, 3) plant only. Then optionally Gemini for hero/description.
 * Does NOT write to global_plant_cache.
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
    const stream = body?.stream === true;

    // Profiles that need filling: missing hero (and optionally sparse metadata)
    const { data: profiles, error: profilesError } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, hero_image_url, hero_image_path, sun, plant_spacing, days_to_germination, harvest_days, scientific_name, plant_description, growing_notes")
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

    const missingDescription = (p: { plant_description?: string | null }) => !(p.plant_description ?? "").trim();

    // Include profile if missing hero OR sparse metadata OR missing description (so cache/AI can fill)
    const needFilling = profiles.filter(
      (p: { hero_image_url?: string | null; hero_image_path?: string | null; sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null; plant_description?: string | null }) =>
        missingHero(p) || metadataSparse(p) || missingDescription(p)
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
      .select("plant_profile_id, vendor_name, purchase_url")
      .eq("user_id", user.id)
      .in("plant_profile_id", profileIds)
      .order("created_at", { ascending: true });

    const vendorByProfile: Record<string, string> = {};
    const urlByProfile: Record<string, string> = {};
    (packets ?? []).forEach((row: { plant_profile_id: string; vendor_name: string | null; purchase_url?: string | null }) => {
      if (vendorByProfile[row.plant_profile_id] == null) {
        vendorByProfile[row.plant_profile_id] = (row.vendor_name ?? "").trim() || "";
      }
      if (urlByProfile[row.plant_profile_id] == null) {
        const url = (row.purchase_url ?? "").trim();
        if (url && url.startsWith("http")) urlByProfile[row.plant_profile_id] = url;
      }
    });

    const encoder = stream ? new TextEncoder() : null;

    const runLoop = async (
      enqueue: (obj: Record<string, unknown>) => void
    ): Promise<{ fromCache: number; fromAi: number; failed: number }> => {
      let fromCache = 0;
      let fromAi = 0;
      let failed = 0;
      const total = needFilling.length;
      const arr = needFilling as Array<{
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
      plant_description?: string | null;
      growing_notes?: string | null;
    }>;
      for (let idx = 0; idx < arr.length; idx++) {
      const p = arr[idx];
      const name = (p.name ?? "").trim() || "Imported seed";
      const variety = (p.variety_name ?? "").trim();
      const identityKey = identityKeyFromVariety(name, variety);
      if (!identityKey) {
        failed++;
        continue;
      }

      const vendor = vendorByProfile[p.id] ?? "";
      const vendorKey = vendor ? normalizeVendorKey(vendor) : "";

      let bestRow: CacheRow | null = null;

      // Tier 0: link — if we have a purchase_url, look up cache by that source_url first (never replace existing data)
      const linkUrl = urlByProfile[p.id]?.trim();
      if (linkUrl) {
        const { data: linkRow, error: linkErr } = await supabase
          .from("global_plant_cache")
          .select("id, extract_data, original_hero_url, vendor, scrape_quality, updated_at")
          .eq("source_url", linkUrl)
          .maybeSingle();
        if (!linkErr && linkRow) bestRow = linkRow as CacheRow;
      }

      // Tiers 1–3: by identity_key then plant-only
      if (!bestRow) {
        const { data: rows, error: cacheError } = await supabase
          .from("global_plant_cache")
          .select("id, extract_data, original_hero_url, vendor, scrape_quality, updated_at")
          .eq("identity_key", identityKey)
          .limit(10);

        const typedRows = (cacheError ? [] : (rows ?? [])) as CacheRow[];

        // Tier 1: vendor + variety + plant
        if (typedRows.length > 0 && vendorKey) {
          const byVendor = typedRows.filter((r) => normalizeVendorKey((r.vendor ?? "")) === vendorKey);
          if (byVendor.length > 0) bestRow = pickBestCacheRow(byVendor);
        }
        // Tier 2: variety + plant (any vendor)
        if (!bestRow && typedRows.length > 0) {
          bestRow = pickBestCacheRow(typedRows);
        }
        // Tier 3: plant only (any variety, any vendor)
        if (!bestRow) {
          const typeKey = getCanonicalKey(name);
          if (typeKey) {
            const { data: plantOnlyRows, error: plantErr } = await supabase
              .from("global_plant_cache")
              .select("id, extract_data, original_hero_url, vendor, scrape_quality, updated_at")
              .or(`identity_key.eq.${typeKey},identity_key.like.${typeKey}_%`)
              .limit(10);
            const plantRows = (plantErr ? [] : (plantOnlyRows ?? [])) as CacheRow[];
            bestRow = pickBestCacheRow(plantRows);
          }
        }
      }

      const updates = bestRow ? await buildUpdatesFromCacheRow(p, bestRow) : {};

      if (Object.keys(updates).length === 0) {
        if (useGemini) {
          let didAiUpdate = false;
          const aiHero = await findHeroPhotoWithToken(token, name, variety, vendor, identityKey);
          if (aiHero) {
            const { error: upErr } = await supabase
              .from("plant_profiles")
              .update({ hero_image_url: aiHero })
              .eq("id", p.id)
              .eq("user_id", user.id);
            if (!upErr) { fromAi++; didAiUpdate = true; }
          }
          // Try AI for description/notes when cache had nothing
          const base = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const origin = base.startsWith("http") ? base : `https://${base}`;
          try {
            const enrichRes = await fetch(`${origin}/api/seed/enrich-from-name`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ name, variety }),
            });
            if (enrichRes.ok) {
              const data = (await enrichRes.json()) as { plant_description?: string; growing_notes?: string };
              const aiDesc = (data.plant_description ?? "").trim();
              const aiNotes = (data.growing_notes ?? "").trim();
              if (aiDesc || aiNotes) {
                const aiUpdates: Record<string, unknown> = { description_source: "ai" };
                if (aiDesc) aiUpdates.plant_description = aiDesc;
                if (aiNotes) aiUpdates.growing_notes = aiNotes;
                const { error: aiErr } = await supabase.from("plant_profiles").update(aiUpdates).eq("id", p.id).eq("user_id", user.id);
                if (!aiErr) { if (!didAiUpdate) fromAi++; didAiUpdate = true; }
              }
            }
          } catch {
            // ignore enrich failure
          }
          if (!didAiUpdate) failed++;
        } else failed++;
        const currentName = [name, variety].filter(Boolean).join(" — ") || name;
        enqueue({ type: "progress", current: idx + 1, total, fromCache, fromAi, failed, currentName });
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
        if (useGemini && !updates.hero_image_url) {
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
      const currentName = [name, variety].filter(Boolean).join(" — ") || name;
      enqueue({ type: "progress", current: idx + 1, total, fromCache, fromAi, failed, currentName });
    }
      return { fromCache, fromAi, failed };
    };

    if (stream && encoder) {
      const skipped = profiles.length - needFilling.length;
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              const result = await runLoop((obj) => {
                controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
              });
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "done",
                    ok: true,
                    fromCache: result.fromCache,
                    fromAi: result.fromAi,
                    failed: result.failed,
                    skipped,
                    message: `From cache: ${result.fromCache}. From AI: ${result.fromAi}. No match: ${result.failed}.`,
                  }) + "\n"
                )
              );
            } catch (e) {
              controller.error(e);
            } finally {
              controller.close();
            }
          },
        }),
        { headers: { "Content-Type": "application/x-ndjson" } }
      );
    }

    const result = await runLoop(() => {});
    return NextResponse.json({
      ok: true,
      fromCache: result.fromCache,
      fromAi: result.fromAi,
      failed: result.failed,
      skipped: profiles.length - needFilling.length,
      message: `From cache: ${result.fromCache}. From AI: ${result.fromAi}. No match: ${result.failed}.`,
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
