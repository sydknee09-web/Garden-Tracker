// src/data/zone10b_schedule.ts
// Zone 10b planting reference (SDSC-style Zones 9/10). Used as fallback for vault profiles
// and as the source of truth for the Planting Schedule reference guide (see /schedule).
//
// Source: Originally derived from San Diego Seed Company Quick-Glance (Zones 9/10).
// Cross-reference: Almanac.com planting calendar for Vista 92084 / San Diego for frost-based
// dates and additional crops: https://www.almanac.com/gardening/planting-calendar/zipcode/92084
//
// TODO: Zone-aware scheduling. user_settings.planting_zone is stored but not used.

export interface PlantingData {
    // Zone Specific (Override scraped data)
    sowing_method: string;
    planting_window: string;
    notes?: string;

    // Biological Defaults (Fallback if scraped data is missing/bad; Deep Brain)
    days_to_maturity?: string;
    germination_time?: string;
    sun?: string;
    water?: string;
    spacing?: string;
    sowing_depth?: string;
  }
  
  export const ZONE_10B_SCHEDULE: Record<string, PlantingData> = {
    // --- Warm Season Edibles ---
    "Tomato": {
      sowing_method: "Start Indoors / Transplant",
      planting_window: "Spring: Feb-May (Soil 72°F+)",
      notes: "Trench-plant deep to encourage root development.",
      sun: "Full Sun",
      spacing: "24-36 inches",
      germination_time: "7-14 days",
      days_to_maturity: "75-90 days"
    },
    "Pepper": {
      sowing_method: "Start Indoors / Transplant",
      planting_window: "Spring: Feb-Apr",
      notes: "Highly frost sensitive. In Vista, can be grown as a multi-year perennial.",
      sun: "Full Sun",
      spacing: "12-18 inches",
      germination_time: "10-21 days",
      days_to_maturity: "70-90 days"
    },
    "Eggplant": {
      sowing_method: "Start Indoors / Transplant",
      planting_window: "Spring: Mar-May",
      notes: "Seeds require warm soil (75°F+). Heavy nitrogen feeders.",
      sun: "Full Sun",
      spacing: "18-24 inches",
      germination_time: "7-14 days",
      days_to_maturity: "70-85 days"
    },
    "Squash": {
      sowing_method: "Direct Sow",
      planting_window: "Spring: Mar-Aug",
      notes: "Includes summer (prolific) and winter (storing) varieties.",
      sun: "Full Sun",
      spacing: "24-36 inches",
      germination_time: "7-10 days",
      days_to_maturity: "50-60 days"
    },
    "Zucchini": {
      sowing_method: "Direct Sow",
      planting_window: "Spring: Mar-Aug",
      notes: "Fast growing; harvest small for best flavor.",
      sun: "Full Sun",
      spacing: "24-36 inches",
      days_to_maturity: "45-55 days"
    },
    "Cucumber": {
      sowing_method: "Direct Sow or Transplant",
      planting_window: "Spring: Mar-Jul",
      notes: "Use vertical trellises to manage space and air circulation.",
      sun: "Full Sun",
      spacing: "12 inches",
      germination_time: "3-10 days",
      days_to_maturity: "55-70 days"
    },
    "Melon": {
      sowing_method: "Direct Sow",
      planting_window: "Spring: Mar-Jun",
      notes: "Demands high heat and full sun. Avoid overhead watering.",
      sun: "Full Sun",
      spacing: "36-48 inches",
      days_to_maturity: "70-100 days"
    },
    "Watermelon": {
      sowing_method: "Direct Sow",
      planting_window: "Spring: Mar-Jun",
      notes: "Provide space for sprawling vines. Deep irrigation is vital.",
      sun: "Full Sun",
      spacing: "36-60 inches",
      days_to_maturity: "80-100 days"
    },
    "Banana": {
      sowing_method: "Direct Sow / Transplant",
      planting_window: "Spring: Mar-May",
      notes: "Hillside airflow helps. Ornamental/fruit varieties from seed.",
      sun: "Full Sun",
      spacing: "6-10 feet",
      days_to_maturity: "varies"
    },
    "Corn": {
      sowing_method: "Direct Sow",
      planting_window: "Spring: Mar-Jul",
      notes: "Plant in minimum 4x4 blocks for wind pollination.",
      sun: "Full Sun",
      spacing: "12 inches",
      germination_time: "7-14 days",
      days_to_maturity: "75-90 days"
    },
    "Beans": {
      sowing_method: "Direct Sow",
      planting_window: "Spring: Mar-Aug (Soil 75-85°F)",
      notes: "Soak overnight. Excellent for soil nitrogen fixation.",
      sun: "Full Sun",
      spacing: "4-6 inches",
      germination_time: "7-10 days",
      days_to_maturity: "50-65 days"
    },
    "Sweet Potato": {
      sowing_method: "Transplant (Slips)",
      planting_window: "Late Spring: Apr-Jun",
      notes: "Requires consistently warm soil. Harvest before soil temps drop in winter.",
      sun: "Full Sun",
      spacing: "12-18 inches",
      days_to_maturity: "90-120 days"
    },
    "Okra": {
      sowing_method: "Direct Sow",
      planting_window: "Spring: Apr-Jul",
      notes: "Thrives in highest summer heat (90°F+). Soak seeds before planting.",
      sun: "Full Sun",
      spacing: "12-18 inches",
      germination_time: "10-14 days",
      days_to_maturity: "50-65 days"
    },
    "Pumpkin": {
      sowing_method: "Direct Sow",
      planting_window: "Spring/Summer: Apr-Jun",
      notes: "Plant by June for Halloween harvest.",
      sun: "Full Sun",
      spacing: "36-60 inches",
      days_to_maturity: "90-120 days"
    },
    "Tomatillo": {
      sowing_method: "Start Indoors / Transplant",
      planting_window: "Spring: Feb-Apr",
      notes: "Same family as tomatoes. Needs warm soil to transplant.",
      sun: "Full Sun",
      spacing: "24-36 inches",
      germination_time: "7-14 days",
      days_to_maturity: "75-100 days"
    },
  
    // --- Cool Season & Year-Round Edibles ---
    "Lettuce": {
      sowing_method: "Direct Sow / Transplant",
      planting_window: "Fall/Spring: Sep-May",
      notes: "Bolts in heat. Use shade cloth if temps exceed 80°F.",
      sun: "Part Shade / Full Sun",
      spacing: "6-10 inches",
      germination_time: "7-14 days",
      days_to_maturity: "45-60 days"
    },
    "Kale": {
      sowing_method: "Direct Sow / Transplant",
      planting_window: "Fall/Spring: Sep-May",
      notes: "Extremely hardy; harvest baby greens or mature leaves.",
      sun: "Full Sun / Part Shade",
      spacing: "12-18 inches",
      germination_time: "5-10 days",
      days_to_maturity: "50-65 days"
    },
    "Swiss Chard": {
      sowing_method: "Direct Sow / Transplant",
      planting_window: "Year Round",
      notes: "Surprisingly heat-tolerant for a leafy green.",
      sun: "Full Sun / Part Shade",
      spacing: "8-12 inches",
      days_to_maturity: "50-60 days"
    },
    "Spinach": {
      sowing_method: "Direct Sow",
      planting_window: "Coolest Months: Oct-Feb",
      notes: "Most heat-sensitive green; short growing window in Zone 10.",
      sun: "Part Shade",
      spacing: "4-6 inches",
      germination_time: "7-14 days",
      days_to_maturity: "40-50 days"
    },
    "Arugula": {
      sowing_method: "Direct Sow",
      planting_window: "Sep-May",
      notes: "Fast-growing; peppery flavor increases with heat.",
      sun: "Full Sun / Part Shade",
      spacing: "4-6 inches",
      days_to_maturity: "30-40 days"
    },
    "Carrot": {
      sowing_method: "Direct Sow",
      planting_window: "Year-Round (Avoid peak heat Jul/Aug)",
      notes: "Keep surface moist for 14 days to emerge. Succession plant every 21 days.",
      sun: "Full Sun",
      spacing: "2-3 inches",
      germination_time: "14-21 days",
      days_to_maturity: "60-80 days"
    },
    "Beet": {
      sowing_method: "Direct Sow",
      planting_window: "Fall/Spring: Sep-May",
      notes: "Thin seedlings to prevent overcrowding of bulbs.",
      sun: "Full Sun",
      spacing: "3-4 inches",
      germination_time: "5-10 days",
      days_to_maturity: "50-70 days"
    },
    "Radish": {
      sowing_method: "Direct Sow",
      planting_window: "Year-Round (Except peak heat)",
      notes: "Fastest harvest (25-30 days). Excellent for inter-cropping.",
      sun: "Full Sun",
      spacing: "2-3 inches",
      germination_time: "3-5 days",
      days_to_maturity: "25-30 days"
    },
    "Broccoli": {
      sowing_method: "Start Indoors / Transplant",
      planting_window: "Fall/Winter: Aug-Feb",
      notes: "Requires established roots before the winter solstice.",
      sun: "Full Sun",
      spacing: "18-24 inches",
      germination_time: "7-10 days",
      days_to_maturity: "60-80 days"
    },
    "Cauliflower": {
      sowing_method: "Start Indoors / Transplant",
      planting_window: "Fall/Winter: Aug-Jan",
      notes: "Head development is sensitive to temperature spikes.",
      sun: "Full Sun",
      spacing: "18-24 inches",
      days_to_maturity: "60-80 days"
    },
    "Brussels Sprouts": {
      sowing_method: "Start Indoors / Transplant",
      planting_window: "Fall: Aug-Oct",
      notes: "Difficult in Zone 10. Aphid magnet—watch closely.",
      sun: "Full Sun",
      spacing: "18-24 inches",
      days_to_maturity: "90-110 days"
    },
    "Cabbage": {
      sowing_method: "Start Indoors / Transplant",
      planting_window: "Fall/Winter: Aug-Feb",
      notes: "Cool-season staple. Short-day varieties best for SoCal.",
      sun: "Full Sun",
      spacing: "12-18 inches",
      germination_time: "5-10 days",
      days_to_maturity: "70-90 days"
    },
    "Fennel": {
      sowing_method: "Direct Sow or Transplant",
      planting_window: "Fall/Spring: Sep-Nov, Feb-Mar",
      notes: "Bulb fennel prefers cool weather. Florence fennel for bulbs.",
      sun: "Full Sun",
      spacing: "8-12 inches",
      germination_time: "7-14 days",
      days_to_maturity: "65-90 days"
    },
    "Kohlrabi": {
      sowing_method: "Direct Sow / Transplant",
      planting_window: "Fall/Winter: Sep-Feb",
      notes: "Cool-season. Harvest when bulb is 2-3 inches.",
      sun: "Full Sun",
      spacing: "6-8 inches",
      germination_time: "5-10 days",
      days_to_maturity: "45-60 days"
    },
    "Leeks": {
      sowing_method: "Start Indoors / Transplant",
      planting_window: "Fall/Winter: Oct-Feb",
      notes: "Long season. Hill soil for blanched stems.",
      sun: "Full Sun",
      spacing: "6 inches",
      germination_time: "10-14 days",
      days_to_maturity: "90-120 days"
    },
    "Bok Choy": {
      sowing_method: "Direct Sow / Transplant",
      planting_window: "Fall/Spring: Sep-Nov, Feb-Apr",
      notes: "Bolts in heat. Quick crop in cool weather.",
      sun: "Full Sun / Part Shade",
      spacing: "6-10 inches",
      germination_time: "5-7 days",
      days_to_maturity: "45-60 days"
    },
    "Turnips": {
      sowing_method: "Direct Sow",
      planting_window: "Fall/Winter: Sep-Feb",
      notes: "Greens and roots. Thin for larger roots.",
      sun: "Full Sun",
      spacing: "3-4 inches",
      germination_time: "5-10 days",
      days_to_maturity: "40-60 days"
    },
    "Artichoke": {
      sowing_method: "Transplant",
      planting_window: "Fall/Winter: Oct-Feb",
      notes: "Perennial in Zone 10. Needs plenty of space (4-5 feet).",
      sun: "Full Sun",
      spacing: "36-48 inches"
    },
    "Peas": {
      sowing_method: "Direct Sow",
      planting_window: "Fall/Winter: Sep-Feb",
      notes: "Thrives in cool, moist conditions. Requires a trellis.",
      sun: "Full Sun",
      spacing: "2-4 inches",
      germination_time: "7-14 days",
      days_to_maturity: "60-70 days"
    },
    "Onion": {
      sowing_method: "Start Indoors / Transplant",
      planting_window: "Fall: Oct-Jan",
      notes: "Select 'short-day' varieties for Southern California.",
      sun: "Full Sun",
      spacing: "4-6 inches",
      days_to_maturity: "100-120 days"
    },
    "Garlic": {
      sowing_method: "Direct Sow (Cloves)",
      planting_window: "Fall: Oct-Nov",
      notes: "Plant cloves 2 inches deep. Harvest when lower leaves turn brown.",
      sun: "Full Sun",
      spacing: "4-6 inches",
      days_to_maturity: "240 days"
    },
    "Asparagus": {
      sowing_method: "Transplant (Crowns) or Seed",
      planting_window: "Winter/Spring: Jan-Mar",
      notes: "Perennial. Takes 2-3 years to establish from seed.",
      sun: "Full Sun",
      spacing: "12-18 inches"
    },
    "Potato": {
      sowing_method: "Direct Sow (Tubers)",
      planting_window: "Fall: Sep-Nov",
      notes: "Plant in fall to overwinter and harvest in spring.",
      sun: "Full Sun",
      spacing: "12 inches",
      days_to_maturity: "90-110 days"
    },
  
    // --- Herbs ---
    "Basil": {
      sowing_method: "Direct Sow / Transplant",
      planting_window: "Spring/Summer: Mar-Sep",
      notes: "Heat-loving; highly cold-sensitive. Prune often.",
      sun: "Full Sun",
      spacing: "10-12 inches",
      germination_time: "5-10 days"
    },
    "Cilantro": {
      sowing_method: "Direct Sow",
      planting_window: "Fall/Winter: Oct-Mar",
      notes: "Bolts immediately in heat. Succession sow every 14 days.",
      sun: "Full Sun / Part Shade",
      spacing: "4-8 inches",
      germination_time: "7-10 days"
    },
    "Dill": {
      sowing_method: "Direct Sow",
      planting_window: "Fall/Winter: Oct-Mar",
      notes: "Difficult to transplant. Attracts swallowtail larvae.",
      sun: "Full Sun",
      spacing: "8-12 inches",
      germination_time: "10-14 days"
    },
    "Parsley": {
      sowing_method: "Direct Sow or Transplant",
      planting_window: "Year Round",
      notes: "Soak seeds overnight. Thrives in fall gardens.",
      sun: "Full Sun / Part Shade",
      spacing: "6-10 inches",
      germination_time: "14-28 days"
    },
    "Chives": {
      sowing_method: "Direct Sow or Transplant",
      planting_window: "Fall/Spring: Sep-Nov, Jan-Mar",
      notes: "Perennial. Divide clumps every few years.",
      sun: "Full Sun",
      spacing: "6-8 inches",
      germination_time: "10-14 days"
    },
  
    // --- Flowers ---
    "Celosia": {
      sowing_method: "Start Indoors / Transplant",
      planting_window: "Spring: Mar-Jun",
      notes: "Heat-loving. Do not transplant until soil is warm (65°F+). Deadhead to encourage branching.",
      sun: "Full Sun",
      spacing: "9-12 inches",
      germination_time: "7-14 days",
      days_to_maturity: "90-100 days"
    },
    "Zinnia": {
      sowing_method: "Direct Sow / Transplant",
      planting_window: "Spring/Summer: Mar-Aug",
      notes: "Heat loving. Cut and come again blooms.",
      sun: "Full Sun",
      spacing: "9-12 inches",
      germination_time: "5-7 days"
    },
    "Sunflower": {
      sowing_method: "Direct Sow",
      planting_window: "Spring/Summer: Mar-Jul",
      notes: "Full sun only. Protect seedlings from birds.",
      sun: "Full Sun",
      spacing: "18-24 inches",
      germination_time: "7-14 days"
    },
    "Cosmos": {
      sowing_method: "Direct Sow",
      planting_window: "Spring/Summer: Mar-Aug",
      notes: "Tolerates poor soil and dry conditions.",
      sun: "Full Sun",
      spacing: "9-12 inches",
      germination_time: "5-10 days"
    },
    "Marigold": {
      sowing_method: "Direct Sow / Transplant",
      planting_window: "Spring/Summer: Mar-Aug",
      notes: "Natural pest deterrent. Loves heat.",
      sun: "Full Sun",
      spacing: "8-12 inches",
      germination_time: "5-7 days"
    },
    "Dahlia": {
      sowing_method: "Tubers / Seeds",
      planting_window: "Spring: Mar-May",
      notes: "Do not water tubers until sprouts appear.",
      sun: "Full Sun",
      spacing: "12-24 inches"
    },
    "Poppy": {
      sowing_method: "Direct Sow",
      planting_window: "Fall: Oct-Dec",
      notes: "Surface sow at start of rainy season. Hates transplanting.",
      sun: "Full Sun",
      spacing: "6-8 inches",
      germination_time: "10-20 days"
    },
    "Nasturtium": {
      sowing_method: "Direct Sow",
      planting_window: "Spring/Summer: Mar-Jun",
      notes: "Edible flowers and leaves. Prefers lean soil.",
      sun: "Full Sun / Part Shade",
      spacing: "8-12 inches",
      germination_time: "7-14 days",
      days_to_maturity: "50-60 days"
    },
    "Calendula": {
      sowing_method: "Direct Sow / Transplant",
      planting_window: "Fall/Spring: Sep-Nov, Feb-Apr",
      notes: "Edible petals. Cool-season bloomer.",
      sun: "Full Sun",
      spacing: "8-12 inches",
      germination_time: "7-14 days",
      days_to_maturity: "45-60 days"
    },
    "Lisianthus": {
      sowing_method: "Start Indoors (Very Early)",
      planting_window: "Start: Dec-Jan, Transplant: Mar-Apr",
      notes: "Slow grower. Essential cut flower. Blooms all summer.",
      sun: "Full Sun",
      spacing: "6-8 inches",
      germination_time: "14-20 days"
    },
    "Snapdragon": {
      sowing_method: "Direct Sow or Transplant",
      planting_window: "Fall/Spring: Sep-Mar",
      notes: "Cool season staple. Pinch young plants.",
      sun: "Full Sun",
      spacing: "6-10 inches",
      germination_time: "10-14 days"
    },
    "Strawberry": {
      sowing_method: "Transplant",
      planting_window: "Fall/Winter: Dec-Feb",
      notes: "Needs 8+ hours of sun. Mound in clay soils for drainage.",
      sun: "Full Sun",
      spacing: "12 inches"
    }
  };

/** Normalize plant name to match ZONE_10B_SCHEDULE keys (e.g. "tomato" -> "Tomato"). */
export function toScheduleKey(name: string): string {
  return name.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Get schedule entry for a plant name. Tries exact title-case, then first word, then "contains" (e.g. "Celosia Autumn Blaze" or any variety containing "Celosia" → Celosia schedule). */
export function getZone10bScheduleForPlant(plantName: string): PlantingData | undefined {
  const key = toScheduleKey(plantName);
  if (key && ZONE_10B_SCHEDULE[key]) return ZONE_10B_SCHEDULE[key];
  const firstWord = key?.split(/\s+/)[0]?.trim();
  if (firstWord && ZONE_10B_SCHEDULE[firstWord]) return ZONE_10B_SCHEDULE[firstWord];
  const scheduleKeys = Object.keys(ZONE_10B_SCHEDULE).sort((a, b) => b.length - a.length);
  for (const k of scheduleKeys) {
    if (key && key.includes(k)) return ZONE_10B_SCHEDULE[k];
  }
  return undefined;
}

/** Scraped biological fields used for fallback. */
export type ScrapedBio = {
  sun?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
};

function isEmpty(v: unknown): boolean {
  return v == null || (typeof v === "string" && !v.trim());
}

/** Garbage filter: treat as empty if string has no digit (e.g. ".", "/", or punctuation-only). */
function isEmptyOrNoDigit(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v !== "string") return false;
  const t = v.trim();
  return !t || !/\d/.test(t);
}

/** Sentence filter: if longer than 25 chars, treat as paragraph not a data point — use schedule default. */
const MAX_SPEC_LEN = 25;
function isSentenceLike(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v !== "string") return false;
  return v.trim().length > MAX_SPEC_LEN;
}

function parseDaysToMaturity(s: string | undefined): number | null {
  if (!s?.trim()) return null;
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return Math.round((parseInt(range[1], 10) + parseInt(range[2], 10)) / 2);
  const single = s.match(/(\d+)/);
  return single ? parseInt(single[1], 10) : null;
}

/**
 * Merge scraped data with Zone 10b schedule.
 * - Planting schedule: OVERRIDE sowing_method and planting_window from schedule when matched.
 * - Biological defaults: FALLBACK sun, spacing, germination_time, days_to_maturity only when scraped is null/undefined/empty.
 */
export function applyZone10bToProfile(plantName: string, scraped: ScrapedBio): {
  sun: string | null;
  plant_spacing: string | null;
  days_to_germination: string | null;
  harvest_days: number | null;
  sowing_method: string | null;
  planting_window: string | null;
} {
  const schedule = getZone10bScheduleForPlant(plantName);
  const useSun = !isEmptyOrNoDigit(scraped.sun) && !isSentenceLike(scraped.sun);
  const useSpacing = !isEmptyOrNoDigit(scraped.plant_spacing) && !isSentenceLike(scraped.plant_spacing);
  const useGerm = !isEmptyOrNoDigit(scraped.days_to_germination) && !isSentenceLike(scraped.days_to_germination);
  return {
    sun: useSun ? String(scraped.sun).trim() : (schedule?.sun ?? null),
    plant_spacing: useSpacing ? String(scraped.plant_spacing).trim() : (schedule?.spacing ?? null),
    days_to_germination: useGerm ? String(scraped.days_to_germination).trim() : (schedule?.germination_time ?? null),
    harvest_days:
      !isEmpty(scraped.harvest_days) && typeof scraped.harvest_days === "number"
        ? scraped.harvest_days
        : (schedule?.days_to_maturity ? parseDaysToMaturity(schedule.days_to_maturity) : null),
    sowing_method: schedule?.sowing_method ?? null,
    planting_window: schedule?.planting_window ?? null,
  };
}

/**
 * Same as applyZone10bToProfile but merges in user-defined overrides (e.g. from a map).
 * Deprecated: Brain/schedule_defaults removed; use applyZone10bToProfile for imports.
 */
export function applyZone10bToProfileWithUser(
  plantName: string,
  scraped: ScrapedBio,
  userDefaultsMap: Record<string, PlantingData>
): {
  sun: string | null;
  plant_spacing: string | null;
  days_to_germination: string | null;
  harvest_days: number | null;
  sowing_method: string | null;
  planting_window: string | null;
} {
  const key = toScheduleKey(plantName);
  const staticSchedule = getZone10bScheduleForPlant(plantName);
  const userSchedule = key ? userDefaultsMap[key] : undefined;
  const schedule: PlantingData | undefined = userSchedule
    ? { ...staticSchedule, ...userSchedule }
    : staticSchedule;
  const useSun = !isEmptyOrNoDigit(scraped.sun) && !isSentenceLike(scraped.sun);
  const useSpacing = !isEmptyOrNoDigit(scraped.plant_spacing) && !isSentenceLike(scraped.plant_spacing);
  const useGerm = !isEmptyOrNoDigit(scraped.days_to_germination) && !isSentenceLike(scraped.days_to_germination);
  const harvestFromSchedule =
    schedule?.days_to_maturity != null ? parseDaysToMaturity(schedule.days_to_maturity) : null;
  return {
    sun: useSun ? String(scraped.sun).trim() : (schedule?.sun ?? null),
    plant_spacing: useSpacing ? String(scraped.plant_spacing).trim() : (schedule?.spacing ?? null),
    days_to_germination: useGerm ? String(scraped.days_to_germination).trim() : (schedule?.germination_time ?? null),
    harvest_days:
      !isEmpty(scraped.harvest_days) && typeof scraped.harvest_days === "number"
        ? scraped.harvest_days
        : harvestFromSchedule,
    sowing_method: schedule?.sowing_method ?? null,
    planting_window: schedule?.planting_window ?? null,
  };
}

const MONTH_ABBREVS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export type SowMonths = {
  sow_jan: boolean;
  sow_feb: boolean;
  sow_mar: boolean;
  sow_apr: boolean;
  sow_may: boolean;
  sow_jun: boolean;
  sow_jul: boolean;
  sow_aug: boolean;
  sow_sep: boolean;
  sow_oct: boolean;
  sow_nov: boolean;
  sow_dec: boolean;
};

/** Parse planting_window (e.g. "Spring: Feb-May", "Mar-Aug") to default sow months for Zone 10b / Vista. */
export function getDefaultSowMonthsForZone10b(plantingWindow: string | undefined): SowMonths {
  const out: SowMonths = {
    sow_jan: false, sow_feb: false, sow_mar: false, sow_apr: false, sow_may: false, sow_jun: false,
    sow_jul: false, sow_aug: false, sow_sep: false, sow_oct: false, sow_nov: false, sow_dec: false,
  };
  if (!plantingWindow?.trim()) return out;
  const s = plantingWindow.trim();
  const rangeMatch = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[-–—]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)
    ?? s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[-–—]\s*(\d+)/i);
  if (rangeMatch) {
    const start = MONTH_ABBREVS.findIndex((m) => m.toLowerCase() === rangeMatch[1].toLowerCase());
    let end = MONTH_ABBREVS.findIndex((m) => m.toLowerCase() === (rangeMatch[2] ?? "").toLowerCase());
    if (end === -1 && /^\d+$/.test(rangeMatch[2] ?? "")) end = Math.min(11, parseInt(rangeMatch[2], 10) - 1);
    if (start >= 0 && end >= 0) {
      const keys: (keyof SowMonths)[] = ["sow_jan", "sow_feb", "sow_mar", "sow_apr", "sow_may", "sow_jun", "sow_jul", "sow_aug", "sow_sep", "sow_oct", "sow_nov", "sow_dec"];
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) (out[keys[i]!] as boolean) = true;
    }
  }
  return out;
}