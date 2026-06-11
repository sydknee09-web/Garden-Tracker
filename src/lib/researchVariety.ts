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

export const RESEARCH_PROMPT = `Using Google Search Grounding, find the official product page or a reliable gardening guide for this specific seed variety.

EXACT MATCH ONLY: you must find data for this exact plant name and variety. If you cannot find a reliable source for this exact variety, return exactly {"found": false} and nothing else. Do NOT substitute a related species or different variety, do NOT guess, do NOT suggest a correction — the user's spelling is the source of truth. When you DO find the exact variety, include "found": true in the JSON alongside the fields below.

Also: find a high-quality stock image URL or product photo that represents the Actual Plant or Fruit (not the seed packet) for this variety. Prefer a clear photo of the mature plant, flower, or harvest.

Extract the following and return a single JSON object only (no markdown, no explanation):
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
  zoneClause: string
): Promise<ResearchVarietyOutcome | null> {
  const prompt = `${RESEARCH_PROMPT}\n\nSearch for: ${searchQuery}${zoneClause}`;
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
    const zoneClause = zoneNormalized
      ? `\n\nIMPORTANT — Zone-specific planting window: The user gardens in USDA Hardiness Zone ${zoneNormalized}. For the planting_window field above, return a window calibrated to Zone ${zoneNormalized} frost dates and growing season — NOT a generic window. Always use 3-letter month abbreviations (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec) so downstream parsing works. Examples: "Indoor sow Feb-Mar, transplant after last frost May-Jun" for cold zones; "Direct sow Mar-Apr or Aug-Sep" for mild zones; "Year-round" for tropical zones. VIABILITY CHECK: if this plant CANNOT survive outdoor growing in Zone ${zoneNormalized} year-round (e.g. tropical fruit in cold zones, plants that need winter chill the zone doesn't deliver, plants that need a longer growing season than the zone offers), return the exact string "Not viable in Zone ${zoneNormalized} — indoor / greenhouse only" instead of a window. Use this ONLY for plants that genuinely can't survive outdoor; don't use it for plants that are merely difficult or require extra care. If you cannot find zone-specific guidance for Zone ${zoneNormalized}, return empty string for planting_window rather than a generic window.`
      : "";

    return await runResearchQuery(ai, searchQuery, zoneClause);
  } catch {
    return null;
  }
}
