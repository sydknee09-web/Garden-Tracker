import { NextResponse } from "next/server";
import {
  researchPlantTiered,
  type ResearchLevel,
  type ResearchProfileTags,
} from "@/lib/researchVariety";
import { logApiError } from "@/lib/apiErrorLog";
import { logApiUsageAsync } from "@/lib/logApiUsage";
import { getSupabaseUser } from "@/app/api/import/auth";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, DEFAULT_RATE_LIMIT } from "@/lib/rateLimit";
import { checkDailyAiCeiling } from "@/lib/aiDailyCeiling";

// Tiered retry can run up to 3 sequential Gemini calls (variety/cultivar → combined → species).
export const maxDuration = 60;

function parseCommaList(s: string | undefined): string[] | null {
  if (!s?.trim()) return null;
  const arr = s.split(",").map((x) => x.trim()).filter(Boolean);
  return arr.length > 0 ? arr : null;
}

const SEASON_VOCAB = ["Spring", "Summer", "Fall", "Winter"];

/** Parse "Spring, Summer" → ["Spring","Summer"], canonicalized + restricted to the vocabulary. */
function parseSeasons(s: string | undefined): string[] | null {
  if (!s?.trim()) return null;
  const seen = new Set<string>();
  for (const raw of s.split(",")) {
    const canon = SEASON_VOCAB.find((v) => v.toLowerCase() === raw.trim().toLowerCase());
    if (canon) seen.add(canon);
  }
  return seen.size > 0 ? SEASON_VOCAB.filter((v) => seen.has(v)) : null;
}

/** Parse "3,4,5" → [3,4,5]; clamps to valid months 1-12, dedupes, sorts. */
function parseMonths(s: string | undefined): number[] | null {
  if (!s?.trim()) return null;
  const months = [...new Set(
    s.split(",")
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12)
  )].sort((a, b) => a - b);
  return months.length > 0 ? months : null;
}

/** Parse "6" / "6-8" → first integer (0 allowed — "at last frost"). */
function parseWeeks(s: string | undefined): number | null {
  if (!s?.trim()) return null;
  const m = s.trim().match(/-?\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isInteger(n) ? n : null;
}

/** Parse "65" or "55-70" to a number (use first number). */
function parseDaysToMaturity(s: string | undefined): number | null {
  if (!s?.trim()) return null;
  const match = s.trim().match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/** Parse "2 inches" / "1/4 inch" leading number to numeric (planting_depth column is numeric). */
function parseInchesNumeric(s: string | undefined): number | null {
  if (!s?.trim()) return null;
  const m = s.trim().match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

export type EnrichFromNameResponse = {
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
  companion_plants?: string[] | null;
  avoid_plants?: string[] | null;
  harvest_season?: string[] | null;
  mature_height?: string | null;
  mature_width?: string | null;
  // Classification tags
  lifecycle?: string | null;
  growth_form?: string | null;
  plant_category?: string | null;
  growth_habit?: string | null;
  // Characteristics
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
  // When to Plant (Ship 2)
  when_to_plant_description?: string | null;
  planting_seasons_tags?: string[] | null;
  optimal_planting_months_array?: number[] | null;
  indoor_start_weeks_before_frost?: number | null;
  outdoor_plant_weeks_after_frost?: number | null;
  /** Tier the data was found at — drives plant_profiles.field_provenance in the writers. */
  provenance?: ResearchLevel | null;
  zoneUsed?: string | null;
};

/** Columns selected from / upserted to global_plant_library. Single source of truth so read + write stay aligned. */
const LIBRARY_COLUMNS =
  "mature_height, mature_width, sun, water, spacing, germination_days, harvest_days, description, " +
  "growing_notes, propagation_notes, seed_saving_notes, seed_propagation_context, companion_plants, avoid_plants, " +
  "planting_window, sowing_depth, sowing_method, scientific_name, " +
  "lifecycle, growth_form, plant_category, growth_habit, propagation_method, soil_preference, disease_susceptibility, " +
  "pollination_requirements, toxicity, deer_rabbit_resistance, wildlife_value, invasiveness, native_origin, " +
  "drought_salt_tolerance, synonyms, uses, special_features, water_summary, water_detail, sun_summary, sun_detail, " +
  "harvest_season, spring_indoor_window, spring_outdoor_window, summer_window, fall_outdoor_window, planting_depth, " +
  "family, genus, species, " +
  "when_to_plant_description, planting_seasons_tags, optimal_planting_months_array, indoor_start_weeks_before_frost, outdoor_plant_weeks_after_frost, found_level";

type LibraryRow = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown): string[] | null =>
  Array.isArray(v) ? (v.filter((x): x is string => typeof x === "string" && x.trim() !== "") || null) : null;

const numArr = (v: unknown): number[] | null =>
  Array.isArray(v)
    ? (() => {
        const ns = v.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= 12);
        return ns.length > 0 ? ns : null;
      })()
    : null;

/**
 * Build the full enrich response from a cached global_plant_library row.
 * `fallbackLevel` covers legacy rows with no found_level: variety-keyed rows date from the
 * exact-match-only era (variety data); species-keyed rows are species data by construction.
 */
function responseFromLibraryRow(
  row: LibraryRow,
  userZone: string | null,
  fallbackLevel: ResearchLevel
): EnrichFromNameResponse {
  const storedLevel = str(row.found_level);
  const provenance: ResearchLevel =
    storedLevel === "variety" || storedLevel === "cultivar" || storedLevel === "species"
      ? storedLevel
      : fallbackLevel;
  return {
    provenance,
    when_to_plant_description: str(row.when_to_plant_description),
    planting_seasons_tags: arr(row.planting_seasons_tags),
    optimal_planting_months_array: numArr(row.optimal_planting_months_array),
    indoor_start_weeks_before_frost: num(row.indoor_start_weeks_before_frost),
    outdoor_plant_weeks_after_frost: num(row.outdoor_plant_weeks_after_frost),
    sun: str(row.sun),
    sun_summary: str(row.sun_summary) ?? str(row.sun),
    sun_detail: str(row.sun_detail),
    plant_spacing: str(row.spacing),
    days_to_germination: str(row.germination_days),
    harvest_days: num(row.harvest_days),
    sowing_depth: str(row.sowing_depth),
    planting_depth: num(row.planting_depth),
    sowing_method: str(row.sowing_method),
    planting_window: str(row.planting_window),
    spring_indoor_window: str(row.spring_indoor_window),
    spring_outdoor_window: str(row.spring_outdoor_window),
    summer_window: str(row.summer_window),
    fall_outdoor_window: str(row.fall_outdoor_window),
    water: str(row.water),
    water_summary: str(row.water_summary) ?? str(row.water),
    water_detail: str(row.water_detail),
    plant_description: str(row.description),
    growing_notes: str(row.growing_notes),
    propagation_notes: str(row.propagation_notes),
    propagation_method: arr(row.propagation_method),
    seed_saving_notes: str(row.seed_saving_notes),
    seed_propagation_context: str(row.seed_propagation_context),
    companion_plants: arr(row.companion_plants),
    avoid_plants: arr(row.avoid_plants),
    harvest_season: arr(row.harvest_season),
    mature_height: str(row.mature_height),
    mature_width: str(row.mature_width),
    lifecycle: str(row.lifecycle),
    growth_form: str(row.growth_form),
    plant_category: str(row.plant_category),
    growth_habit: str(row.growth_habit),
    soil_preference: str(row.soil_preference),
    disease_susceptibility: arr(row.disease_susceptibility),
    pollination_requirements: str(row.pollination_requirements),
    toxicity: str(row.toxicity),
    deer_rabbit_resistance: str(row.deer_rabbit_resistance),
    wildlife_value: str(row.wildlife_value),
    invasiveness: str(row.invasiveness),
    native_origin: str(row.native_origin),
    drought_salt_tolerance: str(row.drought_salt_tolerance),
    synonyms: arr(row.synonyms),
    uses: arr(row.uses),
    special_features: arr(row.special_features),
    family: str(row.family),
    genus: str(row.genus),
    species: str(row.species),
    zoneUsed: userZone,
  };
}

/**
 * Enrich plant profile from name + variety only (no vendor in search). Used for store-bought new profiles.
 * `forceRefresh: true` (set by explicit user actions — AI Overwrite / AI Fill Blanks) skips the
 * global_plant_library cache branch and goes straight to Gemini, then writes the rich result back
 * to the library so the cache grows (audit 2026-06-10 §7 — the silent-no-op cache-bypass fix).
 */
export async function POST(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const variety = typeof body?.variety === "string" ? body.variety.trim() : "";
    const forceRefresh = Boolean(body?.forceRefresh);
    // Optional three-tag schema values from the caller's profile — drive tier-1 prompt framing.
    // Absent/empty tags fall back to the untagged ladder (variety → combined → species).
    const tagsBody = (body?.tags ?? null) as Record<string, unknown> | null;
    const tagStr = (k: string) =>
      tagsBody && typeof tagsBody[k] === "string" ? (tagsBody[k] as string).trim() : "";
    const profileTags: ResearchProfileTags = {
      lifecycle: tagStr("lifecycle"),
      growth_form: tagStr("growth_form"),
      plant_category: tagStr("plant_category"),
    };
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const key = auth?.user?.id ?? "anon";
    if (!checkRateLimit(key, DEFAULT_RATE_LIMIT)) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    // Read user's planting zone for zone-aware enrichment (BUGS.md Post-Launch #1).
    // The library cache (global_plant_library) is keyed on identity only, not zone,
    // so for non-10b users we skip the cache and let AI regenerate a zone-keyed window.
    let userZone: string | null = null;
    if (auth?.supabase && auth?.user?.id) {
      try {
        const { data: zoneRow } = await auth.supabase
          .from("user_settings")
          .select("planting_zone")
          .eq("user_id", auth.user.id)
          .maybeSingle();
        const rawZone = (zoneRow as { planting_zone?: string | null } | null)?.planting_zone?.trim();
        userZone = rawZone || null;
      } catch {
        // user_settings read failure → fall through with userZone null
      }
    }
    const zoneNormalized = userZone?.toLowerCase().replace(/^zone\s+/, "") ?? null;
    const skipLibrary = zoneNormalized != null && zoneNormalized !== "10b";

    const identityKey = identityKeyFromVariety(name, variety);
    // Species-level cache key: the bare plant-type key. Distinct from identityKey only when a
    // variety is present.
    const speciesKey = identityKeyFromVariety(name, "");

    // Botany brain: check global_plant_library before AI (fallback to AI if table missing or unreachable).
    // Multi-tier read (Ship 2): variety key first, then the species key, before any AI call.
    // forceRefresh (explicit user re-research) bypasses the cache entirely so the AI actually runs.
    if (auth?.supabase && identityKey && !skipLibrary && !forceRefresh) {
      try {
        const { data: libRow } = await auth.supabase
          .from("global_plant_library")
          .select(LIBRARY_COLUMNS)
          .eq("identity_key", identityKey)
          .maybeSingle();
        if (libRow) {
          const response = responseFromLibraryRow(libRow as unknown as LibraryRow, userZone, "variety");
          return NextResponse.json({ enriched: true, found: true, fromCache: true, ...response });
        }
        if (speciesKey && speciesKey !== identityKey) {
          const { data: speciesRow } = await auth.supabase
            .from("global_plant_library")
            .select(LIBRARY_COLUMNS)
            .eq("identity_key", speciesKey)
            .maybeSingle();
          if (speciesRow) {
            const response = responseFromLibraryRow(speciesRow as unknown as LibraryRow, userZone, "species");
            // Species cache hits are tagged species-level — never silently presented as variety data.
            return NextResponse.json({ enriched: true, found: true, fromCache: true, ...response, provenance: "species" });
          }
        }
      } catch {
        // Table/columns may not exist yet (migration not propagated); fall through to AI
      }
    }

    // Durable per-user daily ceiling (Leak 3) — checked after the free library tier
    // so cache hits stay free under the cap.
    if (auth?.user?.id) {
      const daily = await checkDailyAiCeiling(auth.user.id);
      if (!daily.allowed) {
        return NextResponse.json({ error: "DAILY_AI_LIMIT", limit: daily.limit }, { status: 429 });
      }
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" },
        { status: 503 }
      );
    }

    // Tiered research (Ship 2): most-specific framing first (per profile tags), falling broader
    // on each honest not-found; aborts on AI failure. Pass userZone so the AI prompt biases
    // planting_window / months to the user's USDA zone.
    const outcome = await researchPlantTiered(apiKey, name, variety, profileTags, userZone ?? undefined);
    if (!outcome) {
      // AI failed to run / unparseable output → "AI unavailable" semantics.
      return NextResponse.json({ enriched: false });
    }
    // One api_usage row per Gemini call actually made, so the daily ceiling sees true spend.
    if (auth?.user?.id) {
      for (let i = 0; i < outcome.attempts; i++) {
        logApiUsageAsync({ userId: auth.user.id, provider: "gemini", operation: "enrich-from-name" });
      }
    }
    if (!outcome.found) {
      // Not found at ANY tier (B5 honest empty-state). NEVER cached —
      // the next forceRefresh re-attempts the lookup fresh (couldn't-find lock, Syd 2026-06-10).
      console.log(`[enrich-from-name] zone=${userZone ?? "unset"} forceRefresh=${forceRefresh} attempts=${outcome.attempts} found=false`);
      return NextResponse.json({ enriched: false, found: false });
    }
    const result = outcome.data;
    const foundLevel: ResearchLevel = outcome.level;

    console.log(`[enrich-from-name] zone=${userZone ?? "unset"} librarySkipped=${skipLibrary} forceRefresh=${forceRefresh} ai=true level=${foundLevel} attempts=${outcome.attempts}`);

    const harvestDays = parseDaysToMaturity(result.days_to_maturity);
    const response: EnrichFromNameResponse = {
      sun: result.sun_requirement?.trim() || null,
      sun_summary: result.sun_requirement?.trim() || null,
      sun_detail: result.sun_detail?.trim() || null,
      plant_spacing: result.spacing?.trim() || null,
      days_to_germination: result.days_to_germination?.trim() || null,
      harvest_days: harvestDays,
      sowing_depth: result.sowing_depth?.trim() || null,
      planting_depth: parseInchesNumeric(result.planting_depth),
      sowing_method: result.sowing_method?.trim() || null,
      planting_window: result.planting_window?.trim() || null,
      spring_indoor_window: result.spring_indoor_window?.trim() || null,
      spring_outdoor_window: result.spring_outdoor_window?.trim() || null,
      summer_window: result.summer_window?.trim() || null,
      fall_outdoor_window: result.fall_outdoor_window?.trim() || null,
      water: result.water?.trim() || null,
      water_summary: result.water?.trim() || null,
      water_detail: result.water_detail?.trim() || null,
      source_url: result.source_url?.trim() || null,
      plant_description: result.plant_description?.trim() || null,
      growing_notes: result.growing_notes?.trim() || null,
      propagation_notes: result.propagation_notes?.trim() || null,
      propagation_method: parseCommaList(result.propagation_method),
      seed_saving_notes: result.seed_saving_notes?.trim() || null,
      seed_propagation_context: result.seed_propagation_context?.trim() || null,
      companion_plants: parseCommaList(result.companion_plants),
      avoid_plants: parseCommaList(result.avoid_plants),
      harvest_season: parseCommaList(result.harvest_season),
      mature_height: result.mature_height?.trim() || null,
      mature_width: result.mature_width?.trim() || null,
      lifecycle: result.lifecycle?.trim() || null,
      growth_form: result.growth_form?.trim() || null,
      plant_category: result.plant_category?.trim() || null,
      growth_habit: result.growth_habit?.trim() || null,
      soil_preference: result.soil_preference?.trim() || null,
      disease_susceptibility: parseCommaList(result.disease_susceptibility),
      pollination_requirements: result.pollination_requirements?.trim() || null,
      toxicity: result.toxicity?.trim() || null,
      deer_rabbit_resistance: result.deer_rabbit_resistance?.trim() || null,
      wildlife_value: result.wildlife_value?.trim() || null,
      invasiveness: result.invasiveness?.trim() || null,
      native_origin: result.native_origin?.trim() || null,
      drought_salt_tolerance: result.drought_salt_tolerance?.trim() || null,
      synonyms: parseCommaList(result.synonyms),
      uses: parseCommaList(result.uses),
      special_features: parseCommaList(result.special_features),
      family: result.family?.trim() || null,
      genus: result.genus?.trim() || null,
      species: result.species?.trim() || null,
      when_to_plant_description: result.when_to_plant_description?.trim() || null,
      planting_seasons_tags: parseSeasons(result.planting_seasons_tags),
      optimal_planting_months_array: parseMonths(result.optimal_planting_months),
      indoor_start_weeks_before_frost: parseWeeks(result.indoor_start_weeks_before_frost),
      outdoor_plant_weeks_after_frost: parseWeeks(result.outdoor_plant_weeks_after_frost),
      provenance: foundLevel,
      zoneUsed: userZone,
    };

    // Upsert result into global_plant_library so the brain grows (service role only).
    // Writes the FULL field set so a future cache hit is as rich as this AI fill (NORTH_STAR §1).
    // Cache key matches the scope the data was found at: variety/cultivar/combined-name hits key
    // on the name+variety identity; only the bare species lookup keys on the species key, where
    // every variety of that plant shares it. found_level keeps species data honest either way.
    const cacheKey = outcome.cacheScope === "species" ? speciesKey : identityKey;
    const admin = getSupabaseAdmin();
    if (admin && cacheKey) {
      try {
        await admin.from("global_plant_library").upsert(
          {
            identity_key: cacheKey,
            found_level: foundLevel,
            when_to_plant_description: response.when_to_plant_description ?? null,
            planting_seasons_tags: response.planting_seasons_tags ?? null,
            optimal_planting_months_array: response.optimal_planting_months_array ?? null,
            indoor_start_weeks_before_frost: response.indoor_start_weeks_before_frost ?? null,
            outdoor_plant_weeks_after_frost: response.outdoor_plant_weeks_after_frost ?? null,
            mature_height: response.mature_height ?? null,
            mature_width: response.mature_width ?? null,
            sun: response.sun ?? null,
            water: response.water ?? null,
            spacing: response.plant_spacing ?? null,
            germination_days: response.days_to_germination ?? null,
            harvest_days: response.harvest_days ?? null,
            description: response.plant_description ?? response.growing_notes ?? null,
            growing_notes: response.growing_notes ?? null,
            propagation_notes: response.propagation_notes ?? null,
            seed_saving_notes: response.seed_saving_notes ?? null,
            seed_propagation_context: response.seed_propagation_context ?? null,
            companion_plants: response.companion_plants ?? null,
            avoid_plants: response.avoid_plants ?? null,
            planting_window: response.planting_window ?? null,
            sowing_depth: response.sowing_depth ?? null,
            sowing_method: response.sowing_method ?? null,
            lifecycle: response.lifecycle ?? null,
            growth_form: response.growth_form ?? null,
            plant_category: response.plant_category ?? null,
            growth_habit: response.growth_habit ?? null,
            propagation_method: response.propagation_method ?? null,
            soil_preference: response.soil_preference ?? null,
            disease_susceptibility: response.disease_susceptibility ?? null,
            pollination_requirements: response.pollination_requirements ?? null,
            toxicity: response.toxicity ?? null,
            deer_rabbit_resistance: response.deer_rabbit_resistance ?? null,
            wildlife_value: response.wildlife_value ?? null,
            invasiveness: response.invasiveness ?? null,
            native_origin: response.native_origin ?? null,
            drought_salt_tolerance: response.drought_salt_tolerance ?? null,
            synonyms: response.synonyms ?? null,
            uses: response.uses ?? null,
            special_features: response.special_features ?? null,
            water_summary: response.water_summary ?? null,
            water_detail: response.water_detail ?? null,
            sun_summary: response.sun_summary ?? null,
            sun_detail: response.sun_detail ?? null,
            harvest_season: response.harvest_season ?? null,
            spring_indoor_window: response.spring_indoor_window ?? null,
            spring_outdoor_window: response.spring_outdoor_window ?? null,
            summer_window: response.summer_window ?? null,
            fall_outdoor_window: response.fall_outdoor_window ?? null,
            planting_depth: response.planting_depth ?? null,
            family: response.family ?? null,
            genus: response.genus ?? null,
            species: response.species ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "identity_key" }
        );
      } catch {
        // non-fatal (columns may not exist pre-migration)
      }
    }

    return NextResponse.json({ enriched: true, found: true, fromCache: false, ...response });
  } catch (e) {
    logApiError("enrich-from-name", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}
