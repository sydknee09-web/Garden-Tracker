/**
 * Canonical identity key for plant/variety so link import, photo import, bulk-scrape,
 * find-hero-photo, and lookup-by-identity all use the same key format.
 * Format: getCanonicalKey(type)_getCanonicalKey(strippedVariety) — alphanumeric only.
 */
import { getCanonicalKey } from "@/lib/canonicalKey";
import { stripVarietySuffixes } from "@/lib/varietyNormalize";

/** Variety values that are too generic to use as identity (would merge unrelated items). */
const GENERIC_NAME_TRAP = new Set(["vegetables", "seeds", "cool season", "shop"]);

export function isGenericTrapName(variety: string): boolean {
  const v = (variety ?? "").trim().toLowerCase();
  return v.length > 0 && GENERIC_NAME_TRAP.has(v);
}

/**
 * Identity key for merging and cache lookups.
 * Same formula everywhere: type and variety normalized to alphanumeric, variety stripped of suffixes.
 */
export function identityKeyFromVariety(type: string, variety: string): string {
  const strippedVariety = stripVarietySuffixes((variety ?? "").trim());
  if (isGenericTrapName(strippedVariety)) return "";
  const typeKey = getCanonicalKey((type ?? "").trim());
  const varietyKey = getCanonicalKey(strippedVariety);
  if (!typeKey && !varietyKey) return "";
  return (typeKey && varietyKey ? `${typeKey}_${varietyKey}` : typeKey || varietyKey) || "";
}
