/**
 * Seed type categories for Plant Vault filtering.
 * Used for: Refine By Seed Type section, tag suggestions at creation, one-time backfill.
 */

export const SEED_TYPE_TAGS = [
  "Vegetable",
  "Fruit",
  "Edible",
  "Herb",
  "Flower",
  "Cutting Flower",
  "Edible Flower",
  "Ornamental",
  "Ground Cover",
] as const;

export type SeedTypeTag = (typeof SEED_TYPE_TAGS)[number];

/** Normalize for case-insensitive comparison. "Groundcover" maps to "Ground Cover". */
const SEED_TYPE_NORMALIZE: Record<string, SeedTypeTag> = {
  vegetable: "Vegetable",
  fruit: "Fruit",
  edible: "Edible",
  herb: "Herb",
  flower: "Flower",
  "cutting flower": "Cutting Flower",
  "edible flower": "Edible Flower",
  ornamental: "Ornamental",
  "ground cover": "Ground Cover",
  groundcover: "Ground Cover",
};

export function isSeedTypeTag(tag: string): boolean {
  const key = (tag ?? "").trim().toLowerCase();
  return key in SEED_TYPE_NORMALIZE;
}

/** Returns tags from the list that are seed types. */
export function getSeedTypesFromTags(tags: string[] | null | undefined): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    const key = (t ?? "").trim().toLowerCase();
    const canonical = SEED_TYPE_NORMALIZE[key];
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      result.push(canonical);
    }
  }
  return result;
}

/** Plant name (first word or full) -> seed type(s). Used for inference when tags are missing. */
const PLANT_NAME_TO_SEED_TYPE: Record<string, SeedTypeTag[]> = {
  // Vegetables
  tomato: ["Vegetable", "Edible"],
  pepper: ["Vegetable", "Edible"],
  eggplant: ["Vegetable", "Edible"],
  squash: ["Vegetable", "Edible"],
  zucchini: ["Vegetable", "Edible"],
  cucumber: ["Vegetable", "Edible"],
  melon: ["Fruit", "Edible"],
  watermelon: ["Fruit", "Edible"],
  bean: ["Vegetable", "Edible"],
  pea: ["Vegetable", "Edible"],
  lettuce: ["Vegetable", "Edible"],
  spinach: ["Vegetable", "Edible"],
  kale: ["Vegetable", "Edible"],
  chard: ["Vegetable", "Edible"],
  arugula: ["Vegetable", "Edible"],
  beet: ["Vegetable", "Edible"],
  carrot: ["Vegetable", "Edible"],
  radish: ["Vegetable", "Edible"],
  turnip: ["Vegetable", "Edible"],
  onion: ["Vegetable", "Edible"],
  leek: ["Vegetable", "Edible"],
  garlic: ["Vegetable", "Edible"],
  broccoli: ["Vegetable", "Edible"],
  cabbage: ["Vegetable", "Edible"],
  cauliflower: ["Vegetable", "Edible"],
  kohlrabi: ["Vegetable", "Edible"],
  brussels: ["Vegetable", "Edible"],
  corn: ["Vegetable", "Edible"],
  okra: ["Vegetable", "Edible"],
  celery: ["Vegetable", "Edible"],
  asparagus: ["Vegetable", "Edible"],
  artichoke: ["Vegetable", "Edible"],
  potato: ["Vegetable", "Edible"],
  pumpkin: ["Vegetable", "Edible"],
  // Herbs
  basil: ["Herb", "Edible"],
  mint: ["Herb", "Edible"],
  parsley: ["Herb", "Edible"],
  cilantro: ["Herb", "Edible"],
  dill: ["Herb", "Edible"],
  oregano: ["Herb", "Edible"],
  thyme: ["Herb", "Edible"],
  rosemary: ["Herb", "Edible"],
  sage: ["Herb", "Edible"],
  chive: ["Herb", "Edible"],
  lavender: ["Herb", "Flower"],
  chamomile: ["Herb", "Edible Flower"],
  stevia: ["Herb", "Edible"],
  // Flowers
  sunflower: ["Flower", "Edible Flower"],
  zinnia: ["Flower"],
  marigold: ["Flower", "Edible Flower"],
  dahlia: ["Flower", "Cutting Flower"],
  nasturtium: ["Flower", "Edible Flower"],
  calendula: ["Flower", "Edible Flower"],
  pansy: ["Flower", "Edible Flower"],
  viola: ["Flower", "Edible Flower"],
  cosmos: ["Flower", "Cutting Flower"],
  snapdragon: ["Flower", "Cutting Flower"],
  petunia: ["Flower"],
  impatiens: ["Flower"],
  salvia: ["Flower"],
  poppy: ["Flower"],
  bachelor: ["Flower"], // Bachelor's button
  sweet: ["Flower"], // Sweet pea - conflicts with sweet potato; we use first word
  larkspur: ["Flower", "Cutting Flower"],
  hollyhock: ["Flower"],
  coneflower: ["Flower"],
  aster: ["Flower"],
  phlox: ["Flower"],
  bee: ["Flower"], // Bee balm
  // Fruit (trees/vines)
  strawberry: ["Fruit", "Edible"],
  blueberry: ["Fruit", "Edible"],
  raspberry: ["Fruit", "Edible"],
  blackberry: ["Fruit", "Edible"],
  grape: ["Fruit", "Edible"],
  apple: ["Fruit", "Edible"],
  peach: ["Fruit", "Edible"],
  plum: ["Fruit", "Edible"],
  cherry: ["Fruit", "Edible"],
  citrus: ["Fruit", "Edible"],
  lemon: ["Fruit", "Edible"],
  lime: ["Fruit", "Edible"],
  orange: ["Fruit", "Edible"],
  banana: ["Fruit", "Edible"],
  avocado: ["Fruit", "Edible"],
  fig: ["Fruit", "Edible"],
  pomegranate: ["Fruit", "Edible"],
  // Ground cover
  kurapia: ["Ground Cover"],
  dymondia: ["Ground Cover"],
  ceanothus: ["Ground Cover"],
  carex: ["Ground Cover"],
  cistus: ["Ground Cover"],
  sedum: ["Ground Cover"],
  creeping: ["Ground Cover"],
  vinca: ["Ground Cover", "Ornamental"],
  ivy: ["Ground Cover", "Ornamental"],
  // Ornamental
  coleus: ["Ornamental"],
  ageratum: ["Ornamental", "Flower"],
  caladium: ["Ornamental"],
  canna: ["Ornamental", "Flower"],
};

/** Multi-word plant names checked before single-word (e.g. Sweet Pea before Sweet). */
const PLANT_NAME_MULTI_WORD: Record<string, SeedTypeTag[]> = {
  "sweet pea": ["Flower"],
  "sweet potato": ["Vegetable", "Edible"],
};

/** Infer seed types from plant name. Returns empty array if no match. */
export function inferSeedTypesFromPlantName(name: string | null | undefined): SeedTypeTag[] {
  const n = (name ?? "").trim();
  if (!n) return [];
  const fullLower = n.toLowerCase();
  // Check multi-word first
  for (const [key, types] of Object.entries(PLANT_NAME_MULTI_WORD)) {
    if (fullLower === key || fullLower.startsWith(key + " ")) return [...types];
  }
  const firstWord = n.split(/\s+/)[0]?.toLowerCase().trim();
  if (!firstWord) return [];
  const direct = PLANT_NAME_TO_SEED_TYPE[firstWord];
  if (direct) return [...direct];
  return [];
}

/**
 * Get effective seed types for a profile: from tags if any seed-type tags exist,
 * otherwise inferred from plant name.
 */
export function getEffectiveSeedTypes(
  tags: string[] | null | undefined,
  plantName: string | null | undefined
): string[] {
  const fromTags = getSeedTypesFromTags(tags);
  if (fromTags.length > 0) return fromTags;
  return inferSeedTypesFromPlantName(plantName);
}
