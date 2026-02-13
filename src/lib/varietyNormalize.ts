/**
 * Shared variety normalization used by extract (link + image), bulk-scrape, and identity key.
 * Single pipeline so link import, photo import, and global_plant_cache stay consistent.
 */

/** Metadata/suffixes to strip from variety names (order matters: longer first). */
const VARIETY_SUFFIXES = [
  "Drought Tolerant",
  "Selected Seeds",
  "Non-GMO",
  "Seeds",
  "Seed",
  "Organic",
  "Heirloom",
];

/** Strip common suffixes from the end of a variety string. Used for display and identity key consistency. */
export function stripVarietySuffixes(s: string): string {
  let out = (s ?? "").trim().replace(/_/g, " ");
  if (!out) return out;
  const seedsSplit = out.split(/\bSeeds\b/i);
  if (seedsSplit.length > 1) {
    const afterSeeds = (seedsSplit[seedsSplit.length - 1] ?? "").trim();
    if (afterSeeds) out = afterSeeds;
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of VARIETY_SUFFIXES) {
      const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const trailingRe = new RegExp(`\\s*${escaped}\\s*$`, "i");
      const leadingRe = new RegExp(`^\\s*${escaped}\\s*`, "i");
      if (trailingRe.test(out)) {
        out = out.replace(trailingRe, "").trim();
        changed = true;
        break;
      }
      if (leadingRe.test(out)) {
        out = out.replace(leadingRe, "").trim();
        changed = true;
        break;
      }
    }
  }
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/\(\s*\)/g, "").replace(/[^a-zA-Z0-9]+$/g, "").trim();
  out = out.replace(/[-._,\s]+$/g, "").replace(/^[-._,\s]+/g, "").trim();
  out = out.replace(/\s{2,}/g, " ").trim();
  out = out.replace(/\s*\(\s*\)\s*/g, "").trim();
  return out;
}

/** Simple plural form for stripping (e.g. Carrot -> Carrots). */
function pluralOf(plantType: string): string {
  const p = (plantType ?? "").trim().toLowerCase();
  if (!p) return "";
  if (p.endsWith("s") || p.endsWith("x") || p.endsWith("z") || p.endsWith("ch") || p.endsWith("sh")) return p + "es";
  if (p.endsWith("y") && p.length > 1 && !/[aeiou]/.test(p[p.length - 2] ?? "")) return p.slice(0, -1) + "ies";
  if (p.endsWith("o")) return p + "es";
  return p + "s";
}

/**
 * Remove plant type from variety only when it is a redundant prefix or suffix.
 * Boundary-only; no global search-replace.
 */
export function stripPlantFromVariety(variety: string, plantType: string): string {
  const v = (variety ?? "").trim();
  const p = (plantType ?? "").trim();
  if (!p || !v) return v;
  const vLower = v.toLowerCase();
  const plural = pluralOf(plantType);

  const stripFromStart = (): string | null => {
    if (vLower.startsWith(p.toLowerCase() + " ")) return v.slice(p.length + 1).trim();
    if (vLower.startsWith(plural + " ")) return v.slice(plural.length + 1).trim();
    return null;
  };

  const stripFromEnd = (): string | null => {
    const noiseSuffixMatch = v.match(/\s+(Seeds?)\s*$/i);
    const fullNoiseSuffix = noiseSuffixMatch ? (noiseSuffixMatch[0] ?? "") : "";
    const noiseWord = noiseSuffixMatch ? (noiseSuffixMatch[1] ?? "").trim() : "";
    const core = fullNoiseSuffix ? v.slice(0, v.length - fullNoiseSuffix.length).trim() : v;
    const coreLower = core.toLowerCase();
    if (coreLower.endsWith(" " + p.toLowerCase())) {
      const withoutPlant = core.slice(0, core.length - (p.length + 1)).trim();
      return noiseWord ? withoutPlant + " " + noiseWord : withoutPlant;
    }
    if (coreLower.endsWith(" " + plural)) {
      const withoutPlant = core.slice(0, core.length - (plural.length + 1)).trim();
      return noiseWord ? withoutPlant + " " + noiseWord : withoutPlant;
    }
    return null;
  };

  const fromStart = stripFromStart();
  if (fromStart !== null) return fromStart;
  const fromEnd = stripFromEnd();
  if (fromEnd !== null) return fromEnd;
  return v;
}

/**
 * Clean variety for display: strip genetic/marketing terms and maturity, de-duplicate plant_type at end.
 * Returns cleaned variety and tags to add so the tags column carries F1/Hybrid/Heirloom.
 */
export function cleanVarietyForDisplay(
  variety: string,
  plantType: string
): { cleanedVariety: string; tagsToAdd: string[] } {
  let s = (variety ?? "").trim();
  s = stripVarietySuffixes(s);
  const tagsToAdd: string[] = [];

  if (/\bF1\b/i.test(s)) {
    tagsToAdd.push("F1");
    s = s.replace(/\bF1\b/gi, "");
  }
  if (/\bHybrid\b/i.test(s)) {
    tagsToAdd.push("Hybrid");
    s = s.replace(/\bHybrid\b/gi, "");
  }
  if (/\bHeirloom\b/i.test(s)) {
    tagsToAdd.push("Heirloom");
    s = s.replace(/\bHeirloom\b/gi, "");
  }
  if (/\bPelleted\b/i.test(s)) {
    tagsToAdd.push("Pelleted");
    s = s.replace(/\bPelleted\b/gi, "");
  }
  s = s
    .replace(/\b\d+\s*Days?\b/gi, "")
    .replace(/\b\d+-\d+\s*Days?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const typeNorm = (plantType ?? "").trim().toLowerCase();
  if (typeNorm) {
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words[words.length - 1].toLowerCase() === typeNorm) {
      words.pop();
      s = words.join(" ").trim();
    }
  }

  return { cleanedVariety: s, tagsToAdd };
}
