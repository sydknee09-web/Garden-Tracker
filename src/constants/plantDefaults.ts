/**
 * Standardized category library. If a spec is missing from the scrape, the scraper pulls from here based on plant name.
 * This is the first source of truth for growing specs; scraping and AI are fallbacks.
 * Future: a variety-level DB (e.g. plant_specs table) could override per-variety when present.
 */
export type PlantDefaults = {
  sun: string;
  water?: string;
  spacing?: string;
  germination?: string;
  plant_spacing?: string;
  days_to_germination?: string;
  harvest_days?: string;
  life_cycle?: string;
};

export const PLANT_CATEGORY_DEFAULTS: Record<string, PlantDefaults> = {
  Tomato: { sun: "Full Sun", water: "Consistent", spacing: "18–36\"", germination: "7–14 Days" },
  Eggplant: { sun: "Full Sun", water: "Moderate", spacing: "18–24\"", germination: "7–14 Days" },
  Onion: { sun: "Full Sun", water: "Frequent", spacing: "3–5\"", germination: "10–14 Days" },
  Leek: { sun: "Full Sun", water: "Moderate", spacing: "4–6\"", germination: "10–14 Days" },
  Carrot: { sun: "Full Sun", water: "Consistent", spacing: "2–3\"", germination: "14–21 Days" },
  Corn: { sun: "Full Sun", water: "Heavy", spacing: "8–12\"", germination: "7–10 Days" },
  Pepper: { sun: "Full Sun", water: "Moderate", spacing: "12–18\"", germination: "10–21 Days" },
  Squash: { sun: "Full Sun", water: "Heavy", spacing: "24–36\"", germination: "7–10 Days" },
  Okra: { sun: "Full Sun", water: "Moderate", spacing: "12–18\"", germination: "7–14 Days" },
  Broccoli: { sun: "Full Sun", water: "Consistent", spacing: "18–24\"", germination: "7–10 Days" },
  Cabbage: { sun: "Full Sun", water: "Consistent", spacing: "12–18\"", germination: "7–10 Days" },
  Kohlrabi: { sun: "Full Sun", water: "Consistent", spacing: "4–6\"", germination: "5–10 Days" },
  Bean: {
    sun: "Full Sun",
    plant_spacing: "2-4 inches",
    days_to_germination: "8-10 days",
    harvest_days: "50-70 days",
    life_cycle: "Annual",
  },
  Beet: {
    sun: "Full Sun / Partial Shade",
    plant_spacing: "3-4 inches",
    days_to_germination: "7-14 days",
    harvest_days: "50-60 days",
    life_cycle: "Annual",
  },
  Cucumber: {
    sun: "Full Sun",
    plant_spacing: "12 inches",
    days_to_germination: "7-10 days",
    harvest_days: "50-70 days",
    life_cycle: "Annual",
  },
  "Sweet Pea": {
    sun: "Full Sun",
    plant_spacing: "6 inches",
    days_to_germination: "10-28 days",
    harvest_days: "70-90 days",
    life_cycle: "Annual",
  },
  Sunflower: { sun: "Full Sun", water: "Moderate", spacing: "12–24\"", germination: "7–14 Days" },
  Zinnia: { sun: "Full Sun", water: "Moderate", spacing: "9–12\"", germination: "5–10 Days" },
  Marigold: { sun: "Full Sun", water: "Moderate", spacing: "8–12\"", germination: "5–10 Days" },
  Dahlia: { sun: "Full Sun", water: "Low Water", spacing: "12–18\"", germination: "7–14 Days" },
  "California Native": { sun: "Full Sun", water: "Low Water", spacing: "12–24\"", germination: "14–21 Days" },
  Banana: { sun: "Full Sun", water: "Moderate", spacing: "6-10 feet", germination: "varies" },
  general: { sun: "Full Sun", water: "Moderate", spacing: "12–24\"", germination: "7–21 Days" },
};

export type PlantCategoryKey = keyof typeof PLANT_CATEGORY_DEFAULTS;
