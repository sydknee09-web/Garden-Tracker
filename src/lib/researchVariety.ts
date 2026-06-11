/**
 * Shared research logic: Gemini + Search for plant/variety details (description, growing notes, specs).
 * Used by: API route (enrich-from-name, extract), fill-in-blanks, and backfill CLI script.
 *
 * Sprint 4 Chunk A: prompt expanded to fill the full plant-profile field set (3-tag taxonomy,
 * characteristics, per-season windows, paired summary/detail, taxonomy).
 *
 * Sprint 4 Chunk B (variety-not-found lock, Syd 2026-06-10): EXACT MATCH ONLY. The species-level
 * fallback fill is removed — if the specific name+variety can't be found, the model returns
 * {"found": false} and we surface an honest empty-state instead of filling with species-generic
 * data masquerading as variety-specific (NORTH_STAR §2 — a clear empty state beats a misleading
 * filled one). researchVariety now returns a discriminated outcome so every caller handles
 * not-found consciously; null remains "AI failed to run/parse" (quota, network, bad JSON).
 */

import { GoogleGenAI } from "@google/genai";

/**
 * Ship 2 (2026-06-11): the prompt splits into a framing-specific preamble + the shared field
 * list, so one extraction contract serves three lookup framings:
 * - "variety"  — seed variety of a plant (the original framing; packet path unchanged)
 * - "cultivar" — named cultivar of a perennial tree/shrub/vine
 * - "species"  — a plant by its (full) common name; used for combined-name and species tiers
 * Every framing keeps the EXACT MATCH ONLY honesty contract at ITS level — fallback happens by
 * moving DOWN the tier ladder (researchPlantTiered), never by the model substituting.
 */
export type ResearchFraming = "variety" | "cultivar" | "species";

const PREAMBLES: Record<ResearchFraming, string> = {
  variety: `Using Google Search Grounding, find the official product page or a reliable gardening guide for this specific seed variety.

EXACT MATCH ONLY: you must find data for this exact plant name and variety. If you cannot find a reliable source for this exact variety, return exactly {"found": false} and nothing else. Do NOT substitute a related species or different variety, do NOT guess, do NOT suggest a correction — the user's spelling is the source of truth. When you DO find the exact variety, include "found": true in the JSON alongside the fields below.

Also: find a high-quality stock image URL or product photo that represents the Actual Plant or Fruit (not the seed packet) for this variety. Prefer a clear photo of the mature plant, flower, or harvest.`,
  cultivar: `Using Google Search Grounding, find a reliable nursery page or gardening guide for this specific named cultivar of this plant.

EXACT MATCH ONLY: you must find data for this exact cultivar. If you cannot find a reliable source for this exact cultivar, return exactly {"found": false} and nothing else. Do NOT substitute a different cultivar or generic species data, do NOT guess, do NOT suggest a correction — the user's spelling is the source of truth. When you DO find the exact cultivar, include "found": true in the JSON alongside the fields below.

Also: find a high-quality stock image URL that represents the Actual Plant (not packaging) for this cultivar. Prefer a clear photo of the mature plant, flower, or fruit.`,
  species: `Using Google Search Grounding, find a reliable gardening guide or botanical reference for this plant, looked up by the common name given (species-level information).

EXACT MATCH ONLY: you must positively identify this plant by the exact name given. If you cannot identify a real plant matching this name, return exactly {"found": false} and nothing else. Do NOT substitute a different plant, do NOT guess, do NOT suggest a correction — the user's spelling is the source of truth. When you DO identify the plant, include "found": true in the JSON alongside the fields below.

Also: find a high-quality stock image URL that represents the Actual Plant (not packaging). Prefer a clear photo of the mature plant, flower, or harvest.`,
};

const FIELD_LIST = `Extract the following and return a single JSON object only (no markdown, no explanation):
- sowing_depth: e.g. "0.25 inches" or "1/4 inch"
- planting_depth: transplant depth for plugs/bulbs/tubers in inches (DISTINCT from sowing_depth, which is seed depth). e.g. "2 inches". Use empty string if not applicable.
- spacing: e.g. "12-18 inches" or "2 feet"
- sun_requirement: short pill tier — one of "Full Sun", "Part Sun", "Shade", "Bright Indirect" (or "Full Sun to Partial Shade").
- sun_detail: 1-2 sentence detail on light needs (e.g. "Needs 6+ hours of direct sun; tolerates afternoon shade in hot climates"). Use empty string if not found.
- days_to_germination: e.g. "7-14" or "10"
- days_to_maturity: e.g. "65" or "55-70"
- mature_height: Typical mature height in feet/inches (e.g. "3-4 ft", "18 inches"). Use empty string if not found.
- mature_width: Typical mature spread/width (e.g. "2 ft spread", "12 inches"). Use empty string if not found.
- source_url: the URL of the page you used (so the user can verify)
- stock_photo_url: a direct URL (https://...) to a high-quality stock image of the actual plant/fruit for this variety—not the packet. Use empty string if no suitable image found.
- plant_description: 2-4 factual sentences describing this plant/variety (appearance, use, growing context). Gardening-relevant only; no marketing fluff. Use empty string if not found.
- growing_notes: optional short "how to grow" or seed-starting paragraph if easily found; otherwise empty string.
- water: short pill tier — one of "Drought-tolerant", "Minimal", "Regular", "Consistent", "Frequent". Use empty string if not found.
- water_detail: 1-2 sentence detail on watering (e.g. "Keep evenly moist while establishing, then water deeply once a week"). Use empty string if not found.
- sowing_method: how to sow e.g. "Direct Sow", "Start Indoors / Transplant", "Direct Sow or Transplant". Use empty string if not found.
- planting_window: when to plant e.g. "Spring: Mar-May", "After last frost", "Fall: Sep-Nov". Use empty string if not found.
- spring_indoor_window: when to start seeds indoors in spring, e.g. "Feb-Mar". Use empty string if not applicable.
- spring_outdoor_window: when to direct sow / transplant outdoors in spring, e.g. "After last frost, May-Jun". Use empty string if not applicable.
- summer_window: summer planting window if applicable, e.g. "Jun-Jul". Use empty string if not applicable.
- fall_outdoor_window: fall planting window if applicable, e.g. "Aug-Sep". Use empty string if not applicable.
- propagation_notes: how to propagate this plant (cuttings, division, layering, etc.). For perennials and plants that can be multiplied. Use empty string if not applicable or not found.
- propagation_method: comma-separated list of propagation methods from this EXACT vocabulary only: Seed, Cutting, Division, Layering, Grafting, Bulb-Tuber division, Spore, Runner. Multi-value allowed (e.g. "Division, Seed" for Hosta; "Runner, Seed" for Strawberry). Use empty string if not found.
- seed_saving_notes: how to harvest and save seeds from this plant (when to harvest, drying, storage). For seed-grown varieties. Use empty string if not applicable or not found.
- seed_propagation_context: ONE plain sentence (max ~140 chars, sentence case, no marketing language) explaining seed-propagation suitability when it ISN'T the standard path. Use these patterns:
  (a) Plant doesn't grow from seed at all (e.g. most succulents, hostas): "Doesn't grow from seed — propagate from {leaf cuttings | division | runners | offsets} instead."
  (b) Grows from seed but offspring vary widely (e.g. apples, many fruit trees): "Grows from seed, but offspring vary widely — for true-to-type, propagate by {grafting | cuttings | layering}."
  (c) Sterile hybrid or seedlings won't fruit (e.g. seedless watermelon, grafted citrus): "Seedlings may not fruit or breed true — typically propagated by {grafting | cuttings}."
  (d) Standard seed-grown variety (tomatoes, beans, most annuals): return empty string. Do NOT add a caveat just to fill the field.
  Pick the case that matches this specific variety. Use empty string when uncertain rather than guessing.
- companion_plants: comma-separated list of plants that grow well with this variety (e.g. "Basil, Tomatoes, Carrots"). Use empty string if not found.
- avoid_plants: comma-separated list of plants to avoid planting nearby (e.g. "Potatoes, Fennel"). Use empty string if not found.
- harvest_season: comma-separated list from {Early, Mid, Late} x {Spring, Summer, Fall, Winter}, e.g. "Mid Summer, Late Summer". Use empty string if not a harvested plant.

Classification tags — pick from the EXACT vocabulary, single value each:
- lifecycle: one of "Annual", "Biennial", "Perennial". (Worked examples: Apple=Perennial, Tomato=Annual, Peony=Perennial, Grape=Perennial, Lavender=Perennial, Pothos=Perennial.)
- growth_form: one of "Tree", "Shrub", "Vine", "Herbaceous", "Grass", "Groundcover", "Bulb", "Tuber". (Worked examples: Apple=Tree, Tomato=Herbaceous, Peony=Herbaceous, Grape=Vine, Lavender=Shrub, Pothos=Vine.)
- plant_category: one of "Flower", "Fruit", "Vegetable", "Herb", "Ornamental", "Houseplant". (Worked examples: Apple=Fruit, Tomato=Vegetable, Peony=Flower, Grape=Fruit, Lavender=Herb, Pothos=Houseplant.)
- growth_habit: one of "Vining", "Bushing", "Trailing", "Mounding", "Upright", "Spreading", "Climbing", "Clumping". Use empty string if unclear.

Characteristics:
- soil_preference: short phrase e.g. "Well-drained", "Clay tolerant", "Sandy", "Acidic", "Loam". Use empty string if not found.
- when_to_plant_description: 2-4 plain sentences explaining WHEN to plant this plant and WHY (soil warmth, frost sensitivity, season). Example: "Cannas are a spring/summer plant — they need warm soil to grow. Start indoors 6-8 weeks before your last frost, or plant outside once the soil has warmed." Use empty string if not found.
- planting_seasons_tags: comma-separated seasons when planting is appropriate, from the EXACT vocabulary {Spring, Summer, Fall, Winter}, e.g. "Spring, Summer". Use empty string if unknown.
- optimal_planting_months: comma-separated month NUMBERS 1-12 for planting (calibrated to the user's zone if one is given, otherwise typical temperate-climate guidance), e.g. "3,4,5". Use empty string if unknown.
- indoor_start_weeks_before_frost: number of weeks BEFORE the last frost to start this plant indoors, as a number e.g. "6" (for a range like 6-8 weeks, return the midpoint rounded down, "7"). Use empty string if indoor starting is not applicable.
- outdoor_plant_weeks_after_frost: number of weeks AFTER the last frost to plant or sow outside, as a number e.g. "2" ("0" means right at the last frost date). Use empty string if not applicable.
- disease_susceptibility: comma-separated list of common diseases this plant is prone to (e.g. "Powdery mildew, Blight"). Use empty string if none notable.
- pollination_requirements: one of "Self-pollinating", "Cross-pollinating", "Wind", "Hand-pollination needed". Use empty string if not applicable.
- toxicity: short note on pet/human toxicity (e.g. "Toxic to cats and dogs", "Non-toxic"). Use empty string if not found.
- deer_rabbit_resistance: one of "Resistant", "Partial", "Susceptible", "Unknown". Use empty string if not found.
- wildlife_value: short note on wildlife it attracts (e.g. "Attracts bees and butterflies"). Use empty string if not found.
- invasiveness: short note (e.g. "Non-invasive", "Invasive in the Southeast U.S."). Use empty string if not found.
- native_origin: geographic native range (e.g. "Eastern North America", "Mediterranean"). Use empty string if not found.
- drought_salt_tolerance: one of "Tolerant", "Partial", "Sensitive". Use empty string if not found.
- synonyms: comma-separated alternative botanical or common names. Use empty string if none.
- uses: comma-separated from {Beds, Containers, Cuisine, Foliage interest, Outdoor, Indoor}. Use empty string if unclear.
- special_features: comma-separated from {Easy-care, Edible, Pollinator-friendly, Cut-and-come-again, Direct-sow, Fragrance, Bloom-first-year}. Use empty string if none.
- family: taxonomic family (e.g. "Solanaceae"). Use empty string if not found.
- genus: taxonomic genus (e.g. "Solanum"). Use empty string if not found.
- species: taxonomic species epithet (e.g. "lycopersicum"). Use empty string if not found.

Use standard units: inches for depth and spacing, days for germination and maturity. Use empty string for any field you cannot find. For the classification tags and pill fields, pick ONLY from the listed vocabulary. Return only valid JSON.`;

export function buildResearchPrompt(framing: ResearchFraming): string {
  return `${PREAMBLES[framing]}\n\n${FIELD_LIST}`;
}

/** The original variety-framed prompt — packet/extract path and prompt-contract tests use this. */
export const RESEARCH_PROMPT = buildResearchPrompt("variety");

export type ResearchVarietyResult = {
  sowing_depth?: string;
  planting_depth?: string;
  spacing?: string;
  sun_requirement?: string;
  sun_detail?: string;
  days_to_germination?: string;
  days_to_maturity?: string;
  mature_height?: string;
  mature_width?: string;
  source_url?: string;
  stock_photo_url?: string;
  plant_description?: string;
  growing_notes?: string;
  water?: string;
  water_detail?: string;
  sowing_method?: string;
  planting_window?: string;
  spring_indoor_window?: string;
  spring_outdoor_window?: string;
  summer_window?: string;
  fall_outdoor_window?: string;
  propagation_notes?: string;
  propagation_method?: string;
  seed_saving_notes?: string;
  seed_propagation_context?: string;
  companion_plants?: string;
  avoid_plants?: string;
  harvest_season?: string;
  // Classification tags
  lifecycle?: string;
  growth_form?: string;
  plant_category?: string;
  growth_habit?: string;
  // When to Plant (Ship 2) — raw strings from the model; the API route parses arrays/ints.
  when_to_plant_description?: string;
  planting_seasons_tags?: string;
  optimal_planting_months?: string;
  indoor_start_weeks_before_frost?: string;
  outdoor_plant_weeks_after_frost?: string;
  // Characteristics
  soil_preference?: string;
  disease_susceptibility?: string;
  pollination_requirements?: string;
  toxicity?: string;
  deer_rabbit_resistance?: string;
  wildlife_value?: string;
  invasiveness?: string;
  native_origin?: string;
  drought_salt_tolerance?: string;
  synonyms?: string;
  uses?: string;
  special_features?: string;
  family?: string;
  genus?: string;
  species?: string;
};

/**
 * Outcome of a research pass. Three states, each with distinct user-facing semantics:
 * - {found: true, data}  — exact variety match; fill normally.
 * - {found: false}       — AI ran and could not find the exact variety; honest empty-state
 *                          (B5 toast + inline notice + Try Again). NEVER cached.
 * - null                 — AI failed to run or returned unparseable output (quota / network /
 *                          bad JSON); "AI unavailable, try again later".
 */
export type ResearchVarietyOutcome =
  | { found: true; data: ResearchVarietyResult }
  | { found: false };

/**
 * Run ONE Gemini + Google Search research pass for a query string.
 * Returns the parsed outcome, or null when the response has no parseable JSON.
 */
async function runResearchQuery(
  ai: GoogleGenAI,
  searchQuery: string,
  zoneClause: string,
  framing: ResearchFraming = "variety"
): Promise<ResearchVarietyOutcome | null> {
  const prompt = `${buildResearchPrompt(framing)}\n\nSearch for: ${searchQuery}${zoneClause}`;
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });
  const text = response.text?.trim();
  if (!text) return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  // Exact-match-only contract: the model returns {"found": false} when it can't find the
  // exact variety. Treat an explicit false as not-found; anything else (true / legacy
  // responses without the flag) is a found result.
  if (parsed.found === false) return { found: false };
  const getStr = (k: string) => (typeof parsed[k] === "string" ? (parsed[k] as string).trim() : "");
  let source_url = getStr("source_url");
  if (!source_url && response.candidates?.[0]?.groundingMetadata?.groundingChunks?.length) {
    const firstWeb = response.candidates[0].groundingMetadata.groundingChunks.find(
      (c: { web?: { uri?: string } }) => c.web?.uri
    );
    source_url = firstWeb?.web?.uri ?? "";
  }
  const s = (k: string) => getStr(k) || undefined;
  // Tolerant accessor for the numeric / list When-to-Plant fields: the model sometimes returns
  // native JSON numbers or arrays despite the comma-separated-string ask. Normalize to string.
  const sFlex = (k: string): string | undefined => {
    const v = parsed[k];
    if (typeof v === "string") return v.trim() || undefined;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (Array.isArray(v)) {
      const joined = v
        .filter((x) => typeof x === "string" || (typeof x === "number" && Number.isFinite(x)))
        .map((x) => String(x).trim())
        .filter(Boolean)
        .join(",");
      return joined || undefined;
    }
    return undefined;
  };
  const data: ResearchVarietyResult = {
    sowing_depth: s("sowing_depth"),
    planting_depth: s("planting_depth"),
    spacing: s("spacing"),
    sun_requirement: s("sun_requirement"),
    sun_detail: s("sun_detail"),
    days_to_germination: s("days_to_germination"),
    days_to_maturity: s("days_to_maturity"),
    mature_height: s("mature_height"),
    mature_width: s("mature_width"),
    source_url: source_url || undefined,
    stock_photo_url: s("stock_photo_url"),
    plant_description: s("plant_description"),
    growing_notes: s("growing_notes"),
    water: s("water"),
    water_detail: s("water_detail"),
    sowing_method: s("sowing_method"),
    planting_window: s("planting_window"),
    spring_indoor_window: s("spring_indoor_window"),
    spring_outdoor_window: s("spring_outdoor_window"),
    summer_window: s("summer_window"),
    fall_outdoor_window: s("fall_outdoor_window"),
    propagation_notes: s("propagation_notes"),
    propagation_method: s("propagation_method"),
    seed_saving_notes: s("seed_saving_notes"),
    seed_propagation_context: s("seed_propagation_context"),
    companion_plants: s("companion_plants"),
    avoid_plants: s("avoid_plants"),
    harvest_season: s("harvest_season"),
    lifecycle: s("lifecycle"),
    growth_form: s("growth_form"),
    plant_category: s("plant_category"),
    growth_habit: s("growth_habit"),
    when_to_plant_description: s("when_to_plant_description"),
    planting_seasons_tags: sFlex("planting_seasons_tags"),
    optimal_planting_months: sFlex("optimal_planting_months"),
    indoor_start_weeks_before_frost: sFlex("indoor_start_weeks_before_frost"),
    outdoor_plant_weeks_after_frost: sFlex("outdoor_plant_weeks_after_frost"),
    soil_preference: s("soil_preference"),
    disease_susceptibility: s("disease_susceptibility"),
    pollination_requirements: s("pollination_requirements"),
    toxicity: s("toxicity"),
    deer_rabbit_resistance: s("deer_rabbit_resistance"),
    wildlife_value: s("wildlife_value"),
    invasiveness: s("invasiveness"),
    native_origin: s("native_origin"),
    drought_salt_tolerance: s("drought_salt_tolerance"),
    synonyms: s("synonyms"),
    uses: s("uses"),
    special_features: s("special_features"),
    family: s("family"),
    genus: s("genus"),
    species: s("species"),
  };
  return { found: true, data };
}

/**
 * Name+variety research via Gemini + Google Search. Exact match only — no species-level
 * fallback (variety-not-found lock, Syd 2026-06-10). Returns:
 * - {found: true, data} on an exact-variety match
 * - {found: false} when the AI ran but couldn't find the exact variety (never cache this)
 * - null when the AI failed to run or returned unparseable output
 */
function buildZoneClause(zoneNormalized: string): string {
  return `\n\nIMPORTANT — Zone-specific planting window: The user gardens in USDA Hardiness Zone ${zoneNormalized}. For the planting_window field above, return a window calibrated to Zone ${zoneNormalized} frost dates and growing season — NOT a generic window. Always use 3-letter month abbreviations (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec) so downstream parsing works. Examples: "Indoor sow Feb-Mar, transplant after last frost May-Jun" for cold zones; "Direct sow Mar-Apr or Aug-Sep" for mild zones; "Year-round" for tropical zones. VIABILITY CHECK: if this plant CANNOT survive outdoor growing in Zone ${zoneNormalized} year-round (e.g. tropical fruit in cold zones, plants that need winter chill the zone doesn't deliver, plants that need a longer growing season than the zone offers), return the exact string "Not viable in Zone ${zoneNormalized} — indoor / greenhouse only" instead of a window. Use this ONLY for plants that genuinely can't survive outdoor; don't use it for plants that are merely difficult or require extra care. If you cannot find zone-specific guidance for Zone ${zoneNormalized}, return empty string for planting_window rather than a generic window.`;
}

export async function researchVariety(
  apiKey: string,
  plantType: string,
  variety: string,
  vendor: string,
  userZone?: string
): Promise<ResearchVarietyOutcome | null> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const searchQuery =
      [vendor, plantType, variety].filter(Boolean).join(" ") || "seed planting guide";
    const zoneNormalized = (userZone ?? "").trim();
    const zoneClause = zoneNormalized ? buildZoneClause(zoneNormalized) : "";

    return await runResearchQuery(ai, searchQuery, zoneClause);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ship 2 (2026-06-11): tag-aware tiered research — variety/cultivar → combined
// common name → species → honest not-found. Profile path only (the packet path
// keeps researchVariety above).
// ---------------------------------------------------------------------------

/** Provenance level a tier's data is found at. Stored per-field on plant_profiles.field_provenance. */
export type ResearchLevel = "variety" | "cultivar" | "species";

/** The three-tag schema values that drive prompt framing (all optional — untagged profiles allowed). */
export type ResearchProfileTags = {
  lifecycle?: string | null;
  growth_form?: string | null;
  plant_category?: string | null;
};

export type ResearchTier = {
  framing: ResearchFraming;
  /** Provenance level recorded when THIS tier hits. Combined-name hits are species-level data. */
  level: ResearchLevel;
  /**
   * Which cache identity the hit belongs to. Variety/cultivar/combined-name hits are specific to
   * the name+variety identity ("Australian Tree Fern" data must NOT pollute the bare "Tree Fern"
   * species row); only the bare species lookup caches under the species key, where every variety
   * of that plant can share it.
   */
  cacheScope: "variety" | "species";
  query: string;
};

/**
 * Build the most-specific-first tier ladder for a plant + optional variety + optional tags.
 * - Annual + Vegetable/Herb/Flower → variety framing first (seed-grown; current framing is right)
 * - Perennial + Tree/Shrub/Vine → cultivar framing first
 * - Tagged as anything else (ferns, cannas, palms — the shapes the variety framing breaks on)
 *   → combined-common-name lookup first ("Australian Tree Fern" as one name), then species
 * - Untagged with a variety → variety framing first (preserves existing behavior for pre-tag
 *   profiles), then combined, then species
 * - No variety → species lookup only
 */
export function buildTierLadder(name: string, variety: string, tags?: ResearchProfileTags | null): ResearchTier[] {
  const nameTrim = (name ?? "").trim();
  const varietyTrim = (variety ?? "").trim();
  if (!varietyTrim) {
    return [{ framing: "species", level: "species", cacheScope: "species", query: nameTrim }];
  }
  const combinedQuery = `${nameTrim} ${varietyTrim}`.trim();
  const combined: ResearchTier = { framing: "species", level: "species", cacheScope: "variety", query: combinedQuery };
  const species: ResearchTier = { framing: "species", level: "species", cacheScope: "species", query: nameTrim };

  const lifecycle = (tags?.lifecycle ?? "").trim();
  const growthForm = (tags?.growth_form ?? "").trim();
  const category = (tags?.plant_category ?? "").trim();
  const seedGrown = lifecycle === "Annual" && ["Vegetable", "Herb", "Flower"].includes(category);
  const cultivarShaped = lifecycle === "Perennial" && ["Tree", "Shrub", "Vine"].includes(growthForm);
  const untagged = !lifecycle && !growthForm && !category;

  if (cultivarShaped) {
    return [{ framing: "cultivar", level: "cultivar", cacheScope: "variety", query: combinedQuery }, combined, species];
  }
  if (seedGrown || untagged) {
    return [{ framing: "variety", level: "variety", cacheScope: "variety", query: combinedQuery }, combined, species];
  }
  // Tagged, but neither seed-grown-annual nor woody-perennial: the "variety of X" relationship
  // is exactly what breaks for these plants — go straight to the combined-name lookup.
  return [combined, species];
}

export type ResearchTieredOutcome =
  | {
      found: true;
      level: ResearchLevel;
      cacheScope: "variety" | "species";
      data: ResearchVarietyResult;
      attempts: number;
    }
  | { found: false; attempts: number };

/**
 * Run the tier ladder: most specific first, falling one level broader on each honest not-found.
 * - {found:true, level, data} — a tier hit; level says how specific the data is.
 * - {found:false} — every tier ran and returned not-found (couldn't-find UX).
 * - null — a Gemini call failed to run / returned unparseable output. The ladder ABORTS on the
 *   first null (honest "AI unavailable") rather than continuing — continuing during a quota or
 *   network outage would multiply cost for no signal (leak-hardening 2026-06-10 shape).
 * `attempts` = Gemini calls actually made, so the caller can log true API usage.
 */
export async function researchPlantTiered(
  apiKey: string,
  name: string,
  variety: string,
  tags?: ResearchProfileTags | null,
  userZone?: string
): Promise<ResearchTieredOutcome | null> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const zoneNormalized = (userZone ?? "").trim();
    const zoneClause = zoneNormalized ? buildZoneClause(zoneNormalized) : "";
    const ladder = buildTierLadder(name, variety, tags);
    let attempts = 0;
    for (const tier of ladder) {
      attempts++;
      const outcome = await runResearchQuery(ai, tier.query, zoneClause, tier.framing);
      if (outcome === null) return null;
      if (outcome.found) {
        return { found: true, level: tier.level, cacheScope: tier.cacheScope, data: outcome.data, attempts };
      }
    }
    return { found: false, attempts };
  } catch {
    return null;
  }
}
