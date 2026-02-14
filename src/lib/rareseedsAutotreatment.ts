/**
 * Rareseeds (Baker Creek) autotreatment: derive plant_type and variety from URL slug
 * so e.g. kohlrabi-blauer-speck → Kohlrabi / Blauer Speck.
 */

function toTitleCase(s: string): string {
  return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract slug from a rareseeds.com URL (path segment after last slash, no extension).
 */
export function getRareseedsSlugFromUrl(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    if (!u.hostname.toLowerCase().includes("rareseeds.com")) return null;
    const segments = u.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    return last.replace(/\.(html?|aspx|php)$/i, "").trim() || null;
  } catch {
    return null;
  }
}

/**
 * RareSeeds slug decoder: restore apostrophes in URL slug, then spaces + Title Case.
 * Regex: -s- or -s$ → 's (e.g. benary-s-giant → Benary's Giant), -t- or -t$ → 't (e.g. job-s-tears → Job's Tears).
 */
export function rareSeedsSlugDecoder(slug: string): string {
  const withApostrophes = slug
    .replace(/-s(?=-|$)/gi, "'s")   // -s- or -s$ → 's (benary-s-giant → benary's giant)
    .replace(/-t(?=-|$)/gi, "'t")   // -t- or -t$ → 't (job-s-tears → job's tears)
    .replace(/-/g, " ")             // remaining hyphens → spaces
    .trim();
  return toTitleCase(withApostrophes);
}

/**
 * Convert slug to "slug with spaces" (hyphens → spaces). Uses rareSeedsSlugDecoder for RareSeeds apostrophe + Title Case.
 */
export function slugToSpaced(slug: string): string {
  return rareSeedsSlugDecoder(slug);
}

export type RareSeedsAutotreatmentResult = {
  plant_name: string;
  variety_name: string;
};

/**
 * Rareseeds autotreatment: match slug (with spaces, title-cased) against known plant_type list.
 * - If a known plant_type matches at the start of the slug, use it as plant_name and the rest as variety_name.
 * - If no match, use first word as plant_name and the rest as variety_name (new type).
 * @param slugWithSpaces - e.g. "kohlrabi blauer speck" (from slug with hyphens replaced by spaces)
 * @param knownPlantTypes - plant type values from plant_profiles (first word of name), title-case normalized
 */
export function rareseedsAutotreatment(
  slugWithSpaces: string,
  knownPlantTypes: string[]
): RareSeedsAutotreatmentResult {
  const trimmed = slugWithSpaces.trim();
  if (!trimmed) return { plant_name: "General", variety_name: "" };

  const slugTitle = toTitleCase(trimmed);
  const words = trimmed.split(/\s+/).filter(Boolean);

  const sorted = [...knownPlantTypes]
    .filter((t) => t && String(t).trim())
    .map((t) => toTitleCase(String(t).trim()))
    .sort((a, b) => b.length - a.length);

  for (const plantType of sorted) {
    const len = plantType.length;
    if (slugTitle === plantType) {
      return { plant_name: plantType, variety_name: "" };
    }
    if (slugTitle.startsWith(plantType + " ")) {
      let rest = slugTitle.slice(len).trim();
      // e.g. "Zinnia Seeds Benary's Giant White" → variety "Benary's Giant White" (drop leading "Seeds ")
      rest = rest.replace(/^Seeds\s+/i, "").trim();
      return { plant_name: plantType, variety_name: rest };
    }
  }

  if (words.length === 0) return { plant_name: "General", variety_name: "" };
  if (words.length === 1) {
    return { plant_name: toTitleCase(words[0]!), variety_name: "" };
  }
  return {
    plant_name: toTitleCase(words[0]!),
    variety_name: toTitleCase(words.slice(1).join(" ")),
  };
}
