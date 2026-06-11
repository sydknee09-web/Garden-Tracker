import { NextResponse } from "next/server";
import { getSupabaseUser, unauthorized } from "@/app/api/import/auth";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildUpdatesFromCacheRow,
  getBestCacheRow,
  writeEnrichToGlobalCache,
  type EnrichDataForCache,
} from "@/lib/fillBlanksCache";
import { logRequestMetrics } from "@/lib/logRequestMetrics";
import { fetchWithRetry } from "@/lib/fetchWithRetry";

// Single retry (2 attempts) for the slow enrich call below. The route's maxDuration
// is 60s and enrich-from-name is a Gemini call, so we bound retries tightly to
// avoid pushing the route past its serverless budget (an unbounded retry would
// risk the timeout-kill that strands hero_image_pending). 429/503 are no longer
// retryable (leak audit 2026-06-10, Leak 1), so this only fires on genuine
// transients (408/500/502/504/network) — cheap insurance against the
// silent-blank-profile failure Syd hit on PO import 2026-06-08.
const AI_RETRY_DELAYS = [1500];

// Hero gets NO fetch-layer retry: find-hero-photo internally manages its own Gemini
// attempts and returns 200-with-empty-URL on a miss, so a retry here would only
// re-fire the whole hero pipeline and multiply calls during the import fan-out
// (leak audit 2026-06-10, Leak 2 — hero attempts hard-capped per profile).
const HERO_RETRY_DELAYS: number[] = [];

const BACKGROUND_ENRICH_ROUTE_ID = "background-enrich";

export const maxDuration = 60;

async function findHeroPhotoWithToken(
  token: string,
  name: string,
  variety: string,
  vendor: string,
  identityKey?: string,
  scientificName?: string
): Promise<string> {
  const base = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = base.startsWith("http") ? base : `https://${base}`;
  try {
    const res = await fetchWithRetry(
      `${url}/api/seed/find-hero-photo`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          variety,
          vendor,
          identity_key: identityKey ?? undefined,
          scientific_name: scientificName ?? "",
        }),
      },
      { delays: HERO_RETRY_DELAYS }
    );
    const data = (await res.json()) as { hero_image_url?: string };
    return (data.hero_image_url ?? "").trim();
  } catch (e) {
    console.warn("[fill-blanks-for-profile] hero fetch failed after retry:", e instanceof Error ? e.message : e);
    return "";
  }
}

/**
 * Fill blanks for a single profile: cache lookup (global_plant_cache) then optional AI (hero + enrich).
 * When AI is used, hero is written to cache by find-hero-photo; we write AI enrich data to global_plant_cache here.
 * Used after import save so new profiles never persist with empty cells; also callable from Developer.
 *
 * Honest-feedback contract (audit 2026-06-10 §8.4): returns { ok, fromCache, fromAi, enriched, fieldsFilled, error? }
 * so the client can distinguish "filled N fields" / "nothing new" / "AI unavailable" instead of a silent no-op.
 * `forceRefresh: true` (explicit user AI buttons) bypasses BOTH caches and forwards to a fresh Gemini call.
 */
export async function POST(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    if (!auth) return unauthorized();
    const { supabase, user } = auth;

    const body = await req.json().catch(() => ({}));
    const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
    const useGemini = Boolean(body?.useGemini);
    /** When true, only fill metadata; never touch hero/photos. */
    const skipHero = Boolean(body?.skipHero);
    /** When true, skip cache and run AI (hero + enrich), overwriting all AI-fillable fields. */
    const overwrite = Boolean(body?.overwrite);
    /** When true (explicit user re-research), bypass both caches and force a fresh Gemini call. */
    const forceRefresh = Boolean(body?.forceRefresh);
    /** When true, log request metrics with routeId background-enrich for observability. */
    const backgroundEnrich = Boolean(body?.backgroundEnrich);
    const startTime = Date.now();

    /** AI buttons that bypass the cache-first cheap path and go straight to Gemini. */
    const bypassCache = overwrite || forceRefresh;

    if (!profileId) {
      if (backgroundEnrich) logRequestMetrics(BACKGROUND_ENRICH_ROUTE_ID, Date.now() - startTime, 400);
      return NextResponse.json({ error: "profileId required" }, { status: 400 });
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("plant_profiles")
      .select(
        "id, name, variety_name, scientific_name, sun, plant_spacing, days_to_germination, harvest_days, plant_description, growing_notes, water, sowing_depth, sowing_method, planting_window, hero_image_url, hero_image_path, companion_plants, avoid_plants, propagation_notes, seed_saving_notes, seed_propagation_context, " +
          "lifecycle, growth_form, plant_category, growth_habit, propagation_method, soil_preference, disease_susceptibility, pollination_requirements, toxicity, deer_rabbit_resistance, wildlife_value, invasiveness, native_origin, drought_salt_tolerance, synonyms, uses, special_features, water_summary, water_detail, sun_summary, sun_detail, harvest_season, spring_indoor_window, spring_outdoor_window, summer_window, fall_outdoor_window, planting_depth, family, genus, species"
      )
      .eq("id", profileId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profileRow) {
      if (backgroundEnrich) logRequestMetrics(BACKGROUND_ENRICH_ROUTE_ID, Date.now() - startTime, 404);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // The wide select string defeats supabase's row-type inference, so cast to a known shape.
    type ProfileRow = {
      name?: string | null;
      variety_name?: string | null;
      scientific_name?: string | null;
      hero_image_url?: string | null;
      hero_image_path?: string | null;
      plant_description?: string | null;
      growing_notes?: string | null;
      [key: string]: unknown;
    };
    const profile = profileRow as unknown as ProfileRow;

    const { data: packets } = await supabase
      .from("seed_packets")
      .select("vendor_name, purchase_url")
      .eq("plant_profile_id", profileId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const vendor =
      (packets?.[0] as { vendor_name?: string | null } | undefined)?.vendor_name?.trim() ?? "";
    const purchaseUrl = (packets?.[0] as { purchase_url?: string | null } | undefined)?.purchase_url?.trim();

    const name = (profile.name ?? "").trim() || "Imported seed";
    const variety = (profile.variety_name ?? "").trim();
    const identityKey = identityKeyFromVariety(name, variety);
    if (!identityKey) {
      if (backgroundEnrich) logRequestMetrics(BACKGROUND_ENRICH_ROUTE_ID, Date.now() - startTime, 400);
      return NextResponse.json({ error: "Could not derive identity key from name/variety" }, { status: 400 });
    }

    /** Profile field names that received a new value this run (cache + AI). Drives fieldsFilled count. */
    const filledFields = new Set<string>();
    const countUpdate = (obj: Record<string, unknown>) =>
      Object.keys(obj).forEach((k) => {
        if (k !== "description_source") filledFields.add(k);
      });

    const bestRow = !bypassCache ? await getBestCacheRow(supabase, identityKey, purchaseUrl ?? null, vendor) : null;
    let updates = bestRow
      ? await buildUpdatesFromCacheRow(profile as unknown as Parameters<typeof buildUpdatesFromCacheRow>[0], bestRow)
      : {};
    if (skipHero) {
      delete (updates as Record<string, unknown>).hero_image_url;
      delete (updates as Record<string, unknown>).hero_image_path;
    }

    let fromCache = false;
    let fromAi = false;
    let aiEnriched = false;
    let aiNotFound = false;
    let aiError: string | undefined;

    if (!bypassCache && Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("plant_profiles")
        .update(updates)
        .eq("id", profileId)
        .eq("user_id", user.id);
      if (!updateError) {
        fromCache = true;
        countUpdate(updates as Record<string, unknown>);
      }
    }

    const hadNoHero =
      !skipHero &&
      !(profile.hero_image_path ?? "").trim() &&
      (!(profile.hero_image_url ?? "").trim() ||
        (profile.hero_image_url ?? "").trim().toLowerCase().endsWith("seedling-icon.svg") ||
        (profile.hero_image_url ?? "").trim().toLowerCase().endsWith("plant-placeholder.png"));
    const hadNoDescription = !(profile.plant_description ?? "").trim() && !(profile.growing_notes ?? "").trim();
    const stillMissingHero = hadNoHero && !(updates as Record<string, unknown>).hero_image_url;
    const stillMissingDescription =
      hadNoDescription &&
      !(updates as Record<string, unknown>).plant_description &&
      !(updates as Record<string, unknown>).growing_notes;
    const u = updates as Record<string, unknown>;
    const p = profile as Record<string, unknown>;
    const blankStr = (k: string) => !(String(p[k] ?? "").trim()) && !u[k];
    const stillMissingSowingDepth = blankStr("sowing_depth");
    const stillMissingPropagation = blankStr("propagation_notes");
    const stillMissingSeedSaving = blankStr("seed_saving_notes");
    const stillMissingSeedContext = blankStr("seed_propagation_context");
    const stillMissingLifecycle = blankStr("lifecycle");
    const stillMissingCategory = blankStr("plant_category");
    const hasOtherBlanks =
      stillMissingSowingDepth || stillMissingPropagation || stillMissingSeedSaving || stillMissingSeedContext ||
      stillMissingLifecycle || stillMissingCategory;
    const needAi = (useGemini && (stillMissingHero || stillMissingDescription || hasOtherBlanks)) || bypassCache;

    if (needAi) {
      const token = req.headers.get("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7).trim() : null;
      if (stillMissingHero || overwrite) {
        const aiHero = token
          ? await findHeroPhotoWithToken(
              token,
              name,
              variety,
              vendor,
              identityKey,
              (profile as { scientific_name?: string | null }).scientific_name ?? undefined
            )
          : "";
        if (aiHero) {
          await supabase
            .from("plant_profiles")
            .update({ hero_image_url: aiHero })
            .eq("id", profileId)
            .eq("user_id", user.id);
          fromAi = true;
          filledFields.add("hero_image_url");
        }
      }

      const base = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const origin = base.startsWith("http") ? base : `https://${base}`;
      try {
        const enrichRes = await fetchWithRetry(
          `${origin}/api/seed/enrich-from-name`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name, variety, forceRefresh }),
          },
          { delays: AI_RETRY_DELAYS }
        );
        if (enrichRes.ok) {
          const data = (await enrichRes.json()) as Record<string, unknown> & { enriched?: boolean; found?: boolean };
          aiEnriched = data.enriched === true;
          // Variety-not-found (B5): AI ran but couldn't find this exact plant — surface to the
          // client so it shows the couldn't-find toast + inline notice instead of "AI unavailable".
          aiNotFound = data.found === false;

          const dStr = (k: string) => (typeof data[k] === "string" ? (data[k] as string).trim() : "");
          const dNum = (k: string) => (typeof data[k] === "number" && Number.isFinite(data[k]) ? (data[k] as number) : null);
          const dArr = (k: string): string[] => {
            const v = data[k];
            if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
            if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean);
            return [];
          };

          const aiUpdates: Record<string, unknown> = {};
          // Fill-only-blanks unless overwrite: respects the "Fill blanks" vs "Overwrite" button semantics.
          const setStr = (col: string, val: string) => {
            if (val && (overwrite || !String(p[col] ?? "").trim())) aiUpdates[col] = val;
          };
          const setNum = (col: string, val: number | null) => {
            if (val != null && (overwrite || p[col] == null || p[col] === 0)) aiUpdates[col] = val;
          };
          const setArr = (col: string, val: string[]) => {
            const existing = Array.isArray(p[col]) ? (p[col] as unknown[]) : [];
            if (val.length > 0 && (overwrite || existing.length === 0)) aiUpdates[col] = val;
          };

          const aiDesc = dStr("plant_description");
          const aiNotes = dStr("growing_notes");
          setStr("plant_description", aiDesc);
          setStr("growing_notes", aiNotes);
          setStr("sun", dStr("sun"));
          setStr("sun_summary", dStr("sun_summary") || dStr("sun"));
          setStr("sun_detail", dStr("sun_detail"));
          setStr("plant_spacing", dStr("plant_spacing"));
          setStr("days_to_germination", dStr("days_to_germination"));
          setNum("harvest_days", dNum("harvest_days"));
          setStr("sowing_depth", dStr("sowing_depth"));
          setNum("planting_depth", dNum("planting_depth"));
          setStr("water", dStr("water"));
          setStr("water_summary", dStr("water_summary") || dStr("water"));
          setStr("water_detail", dStr("water_detail"));
          setStr("sowing_method", dStr("sowing_method"));
          setStr("planting_window", dStr("planting_window"));
          setStr("spring_indoor_window", dStr("spring_indoor_window"));
          setStr("spring_outdoor_window", dStr("spring_outdoor_window"));
          setStr("summer_window", dStr("summer_window"));
          setStr("fall_outdoor_window", dStr("fall_outdoor_window"));
          setStr("propagation_notes", dStr("propagation_notes"));
          setStr("seed_saving_notes", dStr("seed_saving_notes"));
          setStr("seed_propagation_context", dStr("seed_propagation_context"));
          setStr("lifecycle", dStr("lifecycle"));
          setStr("growth_form", dStr("growth_form"));
          setStr("plant_category", dStr("plant_category"));
          setStr("growth_habit", dStr("growth_habit"));
          setStr("soil_preference", dStr("soil_preference"));
          setStr("pollination_requirements", dStr("pollination_requirements"));
          setStr("toxicity", dStr("toxicity"));
          setStr("deer_rabbit_resistance", dStr("deer_rabbit_resistance"));
          setStr("wildlife_value", dStr("wildlife_value"));
          setStr("invasiveness", dStr("invasiveness"));
          setStr("native_origin", dStr("native_origin"));
          setStr("drought_salt_tolerance", dStr("drought_salt_tolerance"));
          setStr("family", dStr("family"));
          setStr("genus", dStr("genus"));
          setStr("species", dStr("species"));
          const aiCompanions = dArr("companion_plants");
          const aiAvoid = dArr("avoid_plants");
          setArr("companion_plants", aiCompanions);
          setArr("avoid_plants", aiAvoid);
          setArr("propagation_method", dArr("propagation_method"));
          setArr("disease_susceptibility", dArr("disease_susceptibility"));
          setArr("synonyms", dArr("synonyms"));
          setArr("uses", dArr("uses"));
          setArr("special_features", dArr("special_features"));
          setArr("harvest_season", dArr("harvest_season"));

          if (Object.keys(aiUpdates).length > 0) {
            if (aiUpdates.plant_description || aiUpdates.growing_notes) aiUpdates.description_source = "ai";
            const { error: aiErr } = await supabase
              .from("plant_profiles")
              .update(aiUpdates)
              .eq("id", profileId)
              .eq("user_id", user.id);
            if (!aiErr) {
              fromAi = true;
              countUpdate(aiUpdates);
              const admin = getSupabaseAdmin();
              if (admin) {
                const enrichData: EnrichDataForCache = {
                  plant_description: aiDesc || undefined,
                  growing_notes: aiNotes || undefined,
                  sun_requirement: dStr("sun") || undefined,
                  spacing: dStr("plant_spacing") || undefined,
                  days_to_germination: dStr("days_to_germination") || undefined,
                  days_to_maturity: dNum("harvest_days") != null ? String(dNum("harvest_days")) : undefined,
                  sowing_depth: dStr("sowing_depth") || undefined,
                  water: dStr("water") || undefined,
                  sowing_method: dStr("sowing_method") || undefined,
                  planting_window: dStr("planting_window") || undefined,
                  propagation_notes: dStr("propagation_notes") || undefined,
                  seed_saving_notes: dStr("seed_saving_notes") || undefined,
                  seed_propagation_context: dStr("seed_propagation_context") || undefined,
                  companion_plants: aiCompanions.length > 0 ? aiCompanions : undefined,
                  avoid_plants: aiAvoid.length > 0 ? aiAvoid : undefined,
                };
                await writeEnrichToGlobalCache(admin, identityKey, vendor, name, variety, enrichData);
              }
            }
          }
        } else {
          // Non-OK: capture the error code (DAILY_AI_LIMIT / RATE_LIMITED / …) for honest feedback.
          const errData = (await enrichRes.json().catch(() => ({}))) as { error?: string };
          aiError = errData.error || `HTTP_${enrichRes.status}`;
        }
      } catch (e) {
        console.warn("[fill-blanks-for-profile] enrich-from-name failed after retry:", e instanceof Error ? e.message : e);
        aiError = "AI_UNREACHABLE";
      }
    }

    if (backgroundEnrich) logRequestMetrics(BACKGROUND_ENRICH_ROUTE_ID, Date.now() - startTime, 200);
    return NextResponse.json({
      ok: true,
      fromCache,
      fromAi,
      enriched: aiEnriched,
      fieldsFilled: filledFields.size,
      ...(aiNotFound ? { notFound: true } : {}),
      ...(aiError ? { error: aiError } : {}),
    });
  } catch (e) {
    console.error("[fill-blanks-for-profile]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fill failed" },
      { status: 500 }
    );
  }
}
