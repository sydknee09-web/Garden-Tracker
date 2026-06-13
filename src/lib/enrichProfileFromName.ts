/**
 * Enrich an existing plant profile from name + variety.
 * Calls enrich-from-name and find-hero-photo, applies updates.
 * Fill-only-when-empty for growing_notes; never overwrites user-provided data.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { logEvent } from "@/lib/debugLog";
import { CURRENT_AI_FILL_VERSION } from "@/lib/ai-fill/version";

export type EnrichProfileFromNameOptions = {
  vendor?: string;
  /** When true, skip find-hero-photo (e.g. user already uploaded photos). */
  skipHero?: boolean;
  /** Only set growing_notes from AI when this is empty. */
  existingGrowingNotes?: string | null;
  /** For API usage logging and find-hero-photo cache. */
  accessToken?: string | null;
  /**
   * Client-known USDA hardiness zone for observability only. The enrich-from-name
   * API route reads user_settings.planting_zone server-side as the authoritative
   * value for the AI prompt; this field is logged via debugLog so the lifecycle
   * is visible from the caller side. Pass `useUserPlantingZone().zone`.
   */
  userZone?: string | null;
  /**
   * When true, the AI-returned lifecycle also derives profile_type (B6 mapping:
   * Annual → "seed", Biennial/Perennial → "permanent"). Creation flows only —
   * the Seasonal/Permanent toggle was removed there, so AI owns the type.
   * Off by default so packet/variety flows never flip an existing profile_type.
   */
  deriveProfileType?: boolean;
};

export type EnrichProfileFromNameResult = {
  enriched: boolean;
  heroSet: boolean;
};

type EnrichFromNameResponse = {
  enriched?: boolean;
  sun?: string | null;
  sun_summary?: string | null;
  sun_detail?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
  sowing_depth?: string | null;
  planting_depth?: number | null;
  sowing_method?: string | null;
  planting_window?: string | null;
  spring_indoor_window?: string | null;
  spring_outdoor_window?: string | null;
  summer_window?: string | null;
  fall_outdoor_window?: string | null;
  water?: string | null;
  water_summary?: string | null;
  water_detail?: string | null;
  source_url?: string | null;
  plant_description?: string | null;
  growing_notes?: string | null;
  propagation_notes?: string | null;
  propagation_method?: string[] | null;
  seed_saving_notes?: string | null;
  seed_propagation_context?: string | null;
  mature_height?: string | null;
  mature_width?: string | null;
  companion_plants?: string[] | null;
  avoid_plants?: string[] | null;
  harvest_season?: string[] | null;
  // Classification tags
  lifecycle?: string | null;
  growth_form?: string | null;
  plant_category?: string | null;
  growth_habit?: string | null;
  // Characteristics (Sprint 6 #18 — creation writer brought to parity with fill-blanks)
  soil_preference?: string | null;
  disease_susceptibility?: string[] | null;
  pollination_requirements?: string | null;
  toxicity?: string | null;
  deer_rabbit_resistance?: string | null;
  wildlife_value?: string | null;
  invasiveness?: string | null;
  native_origin?: string | null;
  drought_salt_tolerance?: string | null;
  synonyms?: string[] | null;
  uses?: string[] | null;
  special_features?: string[] | null;
  family?: string | null;
  genus?: string | null;
  species?: string | null;
  when_to_plant_description?: string | null;
  planting_seasons_tags?: string[] | null;
  optimal_planting_months_array?: number[] | null;
  indoor_start_weeks_before_frost?: number | null;
  outdoor_plant_weeks_after_frost?: number | null;
  /** Tier the AI found the data at (variety | cultivar | species) — drives field_provenance. */
  provenance?: string | null;
  zoneUsed?: string | null;
};

function authHeaders(accessToken?: string | null): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken?.trim()) h["Authorization"] = `Bearer ${accessToken.trim()}`;
  return h;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return String(e);
  } catch {
    return "unknown";
  }
}

const MAX_FETCH_ATTEMPTS = 2; // 1 initial + 1 retry
const RETRY_DELAY_MS = 2000;

/**
 * Fetch with one retry on network error. HTTP error responses are returned
 * without retry (4xx/5xx mean the server already responded; retrying compounds
 * load on a service that's actively failing).
 */
async function fetchWithRetry(
  profileId: string,
  label: "enrich" | "hero",
  url: string,
  init: RequestInit,
): Promise<Response | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) {
        logEvent("enrich", "retry", { profileId, label, attempt });
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
      const res = await fetch(url, init);
      if (!res.ok) {
        logEvent("enrich", "fetch_http_error", { profileId, label, status: res.status, attempt });
        return res;
      }
      return res;
    } catch (e) {
      lastError = e;
      logEvent("enrich", "fetch_network_error", { profileId, label, attempt, error: errMsg(e) });
    }
  }
  logEvent("enrich", `${label}_terminal_error`, { profileId, error: errMsg(lastError) });
  return null;
}

/**
 * Enrich an existing plant profile from name + variety.
 * Updates plant_profiles only; does not touch grow_instances, journal_entries, tasks.
 *
 * Safe to fire-and-forget: catches every fetch / parse / DB write internally,
 * logs each lifecycle event via logEvent("enrich", ...), and always resets
 * hero_image_pending=false in finally. Sets hero_image_pending=true for the
 * full duration so callers can fire this in background and have the card UX
 * pick up "Researching..." automatically via the existing SeedVaultView
 * getThumbState pattern.
 */
export async function enrichProfileFromName(
  supabase: SupabaseClient,
  profileId: string,
  userId: string,
  name: string,
  variety: string,
  options: EnrichProfileFromNameOptions = {}
): Promise<EnrichProfileFromNameResult> {
  const startMs = Date.now();
  const { vendor = "", skipHero = false, existingGrowingNotes, accessToken, deriveProfileType = false } = options;
  const varietyTrim = (variety ?? "").trim();
  const nameTrim = (name ?? "").trim();
  const userZoneTrim = (options.userZone ?? "").trim();

  logEvent("enrich", "start", { profileId, name: nameTrim, variety: varietyTrim, skipHero });
  if (userZoneTrim) {
    logEvent("enrich", "zone_requested", { profileId, userZone: userZoneTrim });
  } else {
    logEvent("enrich", "zone_fallback", { profileId, reason: "no_user_zone" });
  }

  try {
    await supabase
      .from("plant_profiles")
      .update({ hero_image_pending: true })
      .eq("id", profileId)
      .eq("user_id", userId);
  } catch (e) {
    logEvent("enrich", "pending_flag_set_error", { profileId, error: errMsg(e) });
  }

  let enriched = false;
  let heroSet = false;

  try {
    const enrichRes = await fetchWithRetry(profileId, "enrich", "/api/seed/enrich-from-name", {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify({ name: nameTrim, variety: varietyTrim }),
    });

    let enrichData: EnrichFromNameResponse | null = null;
    if (enrichRes && enrichRes.ok) {
      try {
        enrichData = (await enrichRes.json()) as EnrichFromNameResponse;
      } catch (e) {
        logEvent("enrich", "parse_error", { profileId, label: "enrich", error: errMsg(e) });
      }
    }

    if (enrichData?.enriched) {
      enriched = true;
      const aiPlantingWindow = (enrichData.planting_window ?? "").trim();
      if (userZoneTrim && aiPlantingWindow) {
        logEvent("enrich", "zone_window_generated", {
          profileId,
          userZone: enrichData.zoneUsed ?? userZoneTrim,
          window: aiPlantingWindow,
        });
      } else if (userZoneTrim && !aiPlantingWindow) {
        logEvent("enrich", "zone_fallback", { profileId, reason: "ai_no_zone_data" });
      }
      const updates: Record<string, unknown> = {};
      // Current-pipeline enrichment → stamp the generation (enrichment versioning, 2026-06-13).
      updates.enrichment_version = CURRENT_AI_FILL_VERSION;
      if (enrichData.sun != null) updates.sun = enrichData.sun;
      if (enrichData.plant_spacing != null) updates.plant_spacing = enrichData.plant_spacing;
      if (enrichData.days_to_germination != null) updates.days_to_germination = enrichData.days_to_germination;
      if (enrichData.harvest_days != null) updates.harvest_days = enrichData.harvest_days;
      if (enrichData.sowing_depth != null) updates.sowing_depth = enrichData.sowing_depth;
      if (enrichData.sowing_method != null) updates.sowing_method = enrichData.sowing_method;
      if (enrichData.planting_window != null) updates.planting_window = enrichData.planting_window;
      if (enrichData.zoneUsed != null) updates.planting_window_zone = enrichData.zoneUsed;
      if (enrichData.water != null) updates.water = enrichData.water;
      if (enrichData.plant_description != null) updates.plant_description = enrichData.plant_description;
      const aiLifecycle = (enrichData.lifecycle ?? "").trim();
      if (aiLifecycle) {
        updates.lifecycle = aiLifecycle;
        if (deriveProfileType) {
          // B6 mapping (useVaultEditHandlers.ts): Annual → seed; Biennial/Perennial → permanent.
          updates.profile_type = aiLifecycle === "Annual" ? "seed" : "permanent";
        }
      }

      if (enrichData.growing_notes != null && !(existingGrowingNotes ?? "").trim()) {
        updates.growing_notes = enrichData.growing_notes;
      }
      if (enrichData.propagation_notes != null) updates.propagation_notes = enrichData.propagation_notes;
      if (enrichData.seed_saving_notes != null) updates.seed_saving_notes = enrichData.seed_saving_notes;
      if (enrichData.seed_propagation_context != null) updates.seed_propagation_context = enrichData.seed_propagation_context;
      if (enrichData.mature_height != null) updates.mature_height = enrichData.mature_height;
      if (enrichData.mature_width != null) updates.mature_width = enrichData.mature_width;
      if (Array.isArray(enrichData.companion_plants) && enrichData.companion_plants.length > 0) updates.companion_plants = enrichData.companion_plants;
      if (Array.isArray(enrichData.avoid_plants) && enrichData.avoid_plants.length > 0) updates.avoid_plants = enrichData.avoid_plants;
      if (enrichData.when_to_plant_description != null) updates.when_to_plant_description = enrichData.when_to_plant_description;
      if (Array.isArray(enrichData.planting_seasons_tags) && enrichData.planting_seasons_tags.length > 0) updates.planting_seasons_tags = enrichData.planting_seasons_tags;
      if (Array.isArray(enrichData.optimal_planting_months_array) && enrichData.optimal_planting_months_array.length > 0) updates.optimal_planting_months_array = enrichData.optimal_planting_months_array;
      if (typeof enrichData.indoor_start_weeks_before_frost === "number") updates.indoor_start_weeks_before_frost = enrichData.indoor_start_weeks_before_frost;
      if (typeof enrichData.outdoor_plant_weeks_after_frost === "number") updates.outdoor_plant_weeks_after_frost = enrichData.outdoor_plant_weeks_after_frost;

      // Sprint 6 #18: creation-time writer brought to field-parity with the fill-blanks route, so a
      // freshly-created profile shows a populated Plant Characteristics section without a second
      // manual "Fill empty cells". New profiles are blank at creation → unconditional writes (matching
      // the established sun/water/lifecycle pattern above) land on empty fields; provenance loop below
      // tags every written key.
      if (enrichData.sun_summary != null) updates.sun_summary = enrichData.sun_summary;
      if (enrichData.sun_detail != null) updates.sun_detail = enrichData.sun_detail;
      if (enrichData.water_summary != null) updates.water_summary = enrichData.water_summary;
      if (enrichData.water_detail != null) updates.water_detail = enrichData.water_detail;
      if (enrichData.planting_depth != null) updates.planting_depth = enrichData.planting_depth;
      if (enrichData.spring_indoor_window != null) updates.spring_indoor_window = enrichData.spring_indoor_window;
      if (enrichData.spring_outdoor_window != null) updates.spring_outdoor_window = enrichData.spring_outdoor_window;
      if (enrichData.summer_window != null) updates.summer_window = enrichData.summer_window;
      if (enrichData.fall_outdoor_window != null) updates.fall_outdoor_window = enrichData.fall_outdoor_window;
      if (enrichData.growth_form != null) updates.growth_form = enrichData.growth_form;
      if (enrichData.plant_category != null) updates.plant_category = enrichData.plant_category;
      if (enrichData.growth_habit != null) updates.growth_habit = enrichData.growth_habit;
      if (enrichData.soil_preference != null) updates.soil_preference = enrichData.soil_preference;
      if (enrichData.pollination_requirements != null) updates.pollination_requirements = enrichData.pollination_requirements;
      if (enrichData.toxicity != null) updates.toxicity = enrichData.toxicity;
      if (enrichData.deer_rabbit_resistance != null) updates.deer_rabbit_resistance = enrichData.deer_rabbit_resistance;
      if (enrichData.wildlife_value != null) updates.wildlife_value = enrichData.wildlife_value;
      if (enrichData.invasiveness != null) updates.invasiveness = enrichData.invasiveness;
      if (enrichData.native_origin != null) updates.native_origin = enrichData.native_origin;
      if (enrichData.drought_salt_tolerance != null) updates.drought_salt_tolerance = enrichData.drought_salt_tolerance;
      if (enrichData.family != null) updates.family = enrichData.family;
      if (enrichData.genus != null) updates.genus = enrichData.genus;
      if (enrichData.species != null) updates.species = enrichData.species;
      if (Array.isArray(enrichData.propagation_method) && enrichData.propagation_method.length > 0) updates.propagation_method = enrichData.propagation_method;
      if (Array.isArray(enrichData.harvest_season) && enrichData.harvest_season.length > 0) updates.harvest_season = enrichData.harvest_season;
      if (Array.isArray(enrichData.disease_susceptibility) && enrichData.disease_susceptibility.length > 0) updates.disease_susceptibility = enrichData.disease_susceptibility;
      if (Array.isArray(enrichData.synonyms) && enrichData.synonyms.length > 0) updates.synonyms = enrichData.synonyms;
      if (Array.isArray(enrichData.uses) && enrichData.uses.length > 0) updates.uses = enrichData.uses;
      if (Array.isArray(enrichData.special_features) && enrichData.special_features.length > 0) updates.special_features = enrichData.special_features;

      const provenanceLevel = (enrichData.provenance ?? "").trim();
      const needsProfileRead =
        enrichData.source_url != null ||
        (["variety", "cultivar", "species"].includes(provenanceLevel) && Object.keys(updates).length > 0);
      if (needsProfileRead) {
        try {
          const { data: existing } = await supabase
            .from("plant_profiles")
            .select("botanical_care_notes, field_provenance")
            .eq("id", profileId)
            .eq("user_id", userId)
            .single();
          const existingRow = existing as {
            botanical_care_notes?: Record<string, unknown> | null;
            field_provenance?: Record<string, unknown> | null;
          } | null;
          if (enrichData.source_url != null) {
            const existingCare = existingRow?.botanical_care_notes ?? {};
            updates.botanical_care_notes = { ...existingCare, source_url: enrichData.source_url };
          }
          // Provenance tagging: every AI-written data field records the tier its data came from;
          // merge preserves entries for fields not written this run.
          if (["variety", "cultivar", "species"].includes(provenanceLevel)) {
            const existingProvenance =
              existingRow?.field_provenance && typeof existingRow.field_provenance === "object"
                ? existingRow.field_provenance
                : {};
            const newEntries: Record<string, string> = {};
            for (const key of Object.keys(updates)) {
              if (key === "botanical_care_notes" || key === "profile_type" || key === "enrichment_version") continue;
              newEntries[key] = provenanceLevel;
            }
            updates.field_provenance = { ...existingProvenance, ...newEntries };
          }
        } catch (e) {
          logEvent("enrich", "db_read_error", { profileId, label: "enrich_source_url_merge", error: errMsg(e) });
        }
      }

      if (Object.keys(updates).length > 0) {
        try {
          await supabase
            .from("plant_profiles")
            .update(updates)
            .eq("id", profileId)
            .eq("user_id", userId);
          logEvent("enrich", "enrich_success", { profileId, fieldCount: Object.keys(updates).length });
        } catch (e) {
          logEvent("enrich", "db_write_error", { profileId, label: "enrich", error: errMsg(e) });
        }
      }
    }

    if (!skipHero) {
      const idKey = identityKeyFromVariety(nameTrim, varietyTrim);
      const heroRes = await fetchWithRetry(profileId, "hero", "/api/seed/find-hero-photo", {
        method: "POST",
        headers: authHeaders(accessToken),
        body: JSON.stringify({
          name: nameTrim,
          variety: varietyTrim,
          vendor: (vendor ?? "").trim(),
          identity_key: idKey || undefined,
          profile_id: profileId,
        }),
      });

      let heroData: { hero_image_url?: string; hero_image_path?: string; error?: string } | null = null;
      if (heroRes && heroRes.ok) {
        try {
          heroData = await heroRes.json();
        } catch (e) {
          logEvent("enrich", "parse_error", { profileId, label: "hero", error: errMsg(e) });
        }
      }

      const heroUrl = heroData?.hero_image_url?.trim();
      const heroPath = heroData?.hero_image_path?.trim();

      try {
        if (heroPath) {
          await supabase
            .from("plant_profiles")
            .update({ hero_image_path: heroPath, hero_image_url: null })
            .eq("id", profileId)
            .eq("user_id", userId);
          heroSet = true;
          logEvent("enrich", "hero_success", { profileId, kind: "path" });
        } else if (heroUrl && heroUrl.startsWith("http")) {
          await supabase
            .from("plant_profiles")
            .update({ hero_image_url: heroUrl })
            .eq("id", profileId)
            .eq("user_id", userId);
          heroSet = true;
          logEvent("enrich", "hero_success", { profileId, kind: "url" });
        }
      } catch (e) {
        logEvent("enrich", "db_write_error", { profileId, label: "hero", error: errMsg(e) });
      }
    }
  } finally {
    try {
      await supabase
        .from("plant_profiles")
        .update({ hero_image_pending: false })
        .eq("id", profileId)
        .eq("user_id", userId);
    } catch (e) {
      logEvent("enrich", "pending_flag_reset_error", { profileId, error: errMsg(e) });
    }
    logEvent("enrich", "done", { profileId, enriched, heroSet, durationMs: Date.now() - startMs });
  }

  return { enriched, heroSet };
}
