import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildUpdatesFromCacheRow,
  getBestCacheRow,
  isPlaceholderHeroUrl,
  writeEnrichToGlobalCache,
  type EnrichDataForCache,
} from "@/lib/fillBlanksCache";

export const maxDuration = 120;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Fill in blanks: for profiles missing hero, metadata, or plant_description, look up
 * global_plant_cache. Never replace existing data — only fill empty fields.
 * Lookup order: 0) link (cache by purchase_url/source_url), 1) vendor+variety+plant,
 * 2) variety+plant, 3) plant only. Then optionally Gemini for hero/description.
 * When AI is used for description, we write to global_plant_cache so future lookups benefit.
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
    /** When true, only fill metadata (sun, description, etc.); never touch hero/photos. */
    const skipHero = Boolean(body?.skipHero);

    // Profiles that need filling: missing hero (unless skipHero), sparse metadata, or missing description
    const { data: profiles, error: profilesError } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, hero_image_url, hero_image_path, sun, plant_spacing, days_to_germination, harvest_days, scientific_name, plant_description, growing_notes, water, sowing_depth, sowing_method, planting_window")
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

    // Metadata-sparse = missing most of sun, spacing, germination, harvest, water, sowing_depth, sowing_method, planting_window
    const metadataSparse = (p: { sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null; water?: string | null; sowing_depth?: string | null; sowing_method?: string | null; planting_window?: string | null }) => {
      const has = (v: string | number | null | undefined) => (v != null && String(v).trim() !== "" && (typeof v !== "number" || Number.isFinite(v)));
      const count = [p.sun, p.plant_spacing, p.days_to_germination, p.harvest_days, p.water, p.sowing_depth, p.sowing_method, p.planting_window].filter(has).length;
      return count < 2; // include if 0 or 1 of these set
    };

    const missingDescription = (p: { plant_description?: string | null }) => !(p.plant_description ?? "").trim();

    // Include profile if missing hero (unless skipHero) OR sparse metadata OR missing description
    const needFilling = profiles.filter(
      (p: { hero_image_url?: string | null; hero_image_path?: string | null; sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null; plant_description?: string | null; water?: string | null; sowing_depth?: string | null; sowing_method?: string | null; planting_window?: string | null }) =>
        (!skipHero && missingHero(p)) || metadataSparse(p) || missingDescription(p)
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
      water?: string | null;
      sowing_depth?: string | null;
      sowing_method?: string | null;
      planting_window?: string | null;
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
      const linkUrl = urlByProfile[p.id]?.trim();
      const bestRow = await getBestCacheRow(supabase, identityKey, linkUrl ?? null, vendor);
      let updates = bestRow ? await buildUpdatesFromCacheRow(p, bestRow) : {};
      if (skipHero) {
        delete updates.hero_image_url;
        delete updates.hero_image_path;
      }

      if (Object.keys(updates).length === 0) {
        if (useGemini) {
          let didAiUpdate = false;
          if (!skipHero) {
            const aiHero = await findHeroPhotoWithToken(token, name, variety, vendor, identityKey);
            if (aiHero) {
              const { error: upErr } = await supabase
                .from("plant_profiles")
                .update({ hero_image_url: aiHero })
                .eq("id", p.id)
                .eq("user_id", user.id);
              if (!upErr) { fromAi++; didAiUpdate = true; }
            }
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
              const data = (await enrichRes.json()) as {
                plant_description?: string;
                growing_notes?: string;
                sun?: string;
                plant_spacing?: string;
                days_to_germination?: string;
                harvest_days?: number;
                sowing_depth?: string;
                water?: string;
                sowing_method?: string;
                planting_window?: string;
              };
              const aiDesc = (data.plant_description ?? "").trim();
              const aiNotes = (data.growing_notes ?? "").trim();
              const aiSun = (data.sun ?? "").trim();
              const aiSpacing = (data.plant_spacing ?? "").trim();
              const aiGerm = (data.days_to_germination ?? "").trim();
              const aiHarvest = data.harvest_days;
              const aiSowingDepth = (data.sowing_depth ?? "").trim();
              const aiWater = (data.water ?? "").trim();
              const aiSowingMethod = (data.sowing_method ?? "").trim();
              const aiPlantingWindow = (data.planting_window ?? "").trim();
              const hasAiData = aiDesc || aiNotes || aiSun || aiSpacing || aiGerm || (aiHarvest != null && aiHarvest > 0) || aiSowingDepth || aiWater || aiSowingMethod || aiPlantingWindow;
              if (hasAiData) {
                const aiUpdates: Record<string, unknown> = { description_source: "ai" };
                if (aiDesc) aiUpdates.plant_description = aiDesc;
                if (aiNotes) aiUpdates.growing_notes = aiNotes;
                if (aiSun) aiUpdates.sun = aiSun;
                if (aiSpacing) aiUpdates.plant_spacing = aiSpacing;
                if (aiGerm) aiUpdates.days_to_germination = aiGerm;
                if (aiHarvest != null && aiHarvest > 0) aiUpdates.harvest_days = aiHarvest;
                if (aiSowingDepth) aiUpdates.sowing_depth = aiSowingDepth;
                if (aiWater) aiUpdates.water = aiWater;
                if (aiSowingMethod) aiUpdates.sowing_method = aiSowingMethod;
                if (aiPlantingWindow) aiUpdates.planting_window = aiPlantingWindow;
                const { error: aiErr } = await supabase.from("plant_profiles").update(aiUpdates).eq("id", p.id).eq("user_id", user.id);
                if (!aiErr) {
                  if (!didAiUpdate) fromAi++;
                  didAiUpdate = true;
                  const admin = getSupabaseAdmin();
                  if (admin) {
                    const enrichData: EnrichDataForCache = {
                      plant_description: aiDesc || undefined,
                      growing_notes: aiNotes || undefined,
                      sun_requirement: aiSun || undefined,
                      spacing: aiSpacing || undefined,
                      days_to_germination: aiGerm || undefined,
                      days_to_maturity: aiHarvest != null ? String(aiHarvest) : undefined,
                      sowing_depth: aiSowingDepth || undefined,
                      water: aiWater || undefined,
                      sowing_method: aiSowingMethod || undefined,
                      planting_window: aiPlantingWindow || undefined,
                    };
                    await writeEnrichToGlobalCache(admin, identityKey, vendor, name, variety, enrichData);
                  }
                }
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
        // Cache had metadata but no usable hero; optionally fill hero via AI (unless skipHero)
        if (!skipHero && useGemini && !updates.hero_image_url) {
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
