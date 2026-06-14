/**
 * Canonical plant_profiles.plant_category vocabulary (migration 20260610120000:
 * "Canonical home for the Library Seed-Type filter vocab").
 *
 * Backs the Sprint 11.5 primary filter chip row on Library / Packets / Garden.
 * Distinct from constants/seedTypes.ts (which is the tag-INFERRED seed-type vocab
 * surfaced in the rich Refine drawer). plant_category is a single structured field
 * on the profile, AI-fillable during enrichment.
 *
 * Order: edible categories first (Vegetable, Fruit, Herb), then ornamental
 * (Flower, Ornamental, Houseplant) — so the row reads edible→ornamental left-to-right.
 * Chip rows are count-gated, so only categories present in the user's data render.
 */
export const PLANT_CATEGORIES = [
  "Vegetable",
  "Fruit",
  "Herb",
  "Flower",
  "Ornamental",
  "Houseplant",
] as const;

export type PlantCategory = (typeof PLANT_CATEGORIES)[number];

/** plant_category values that classify a plant as edible (decision #2: derive edible from plant_category). */
const EDIBLE_PLANT_CATEGORIES = new Set<string>(["Vegetable", "Fruit", "Herb"]);

/** True when the given plant_category is an edible classification. Null/unknown → non-edible. */
export function isEdiblePlantCategory(category: string | null | undefined): boolean {
  return EDIBLE_PLANT_CATEGORIES.has((category ?? "").trim());
}

/**
 * Build count-gated, canonically-ordered category chips from a list of items
 * carrying a `plant_category` field. Only categories with count > 0 are returned,
 * in PLANT_CATEGORIES order.
 */
export function buildPlantCategoryChips(
  items: { plant_category?: string | null }[]
): { value: string; count: number }[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const cat = (it.plant_category ?? "").trim();
    if (cat) map.set(cat, (map.get(cat) ?? 0) + 1);
  }
  return PLANT_CATEGORIES.filter((c) => (map.get(c) ?? 0) > 0).map((value) => ({
    value,
    count: map.get(value) ?? 0,
  }));
}
