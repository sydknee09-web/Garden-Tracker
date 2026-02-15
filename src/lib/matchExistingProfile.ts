/**
 * Match an import item (plant name + variety) to an existing profile using
 * canonical name/variety keys. Used when adding a packet so we attach to the
 * correct profile instead of creating a duplicate.
 * Only non-deleted profiles should be passed in (caller filters by deleted_at null).
 */
import { getCanonicalKey } from "@/lib/canonicalKey";
import { parseVarietyWithModifiers } from "@/lib/varietyModifiers";

export type ProfileForMatch = {
  id: string;
  name: string | null;
  variety_name: string | null;
};

/**
 * Returns the first profile whose canonical (name, variety_name) matches
 * the given plant name and variety. Variety is normalized via parseVarietyWithModifiers
 * so "Dragon's Egg F1" matches "Dragon's Egg".
 */
export function findExistingProfileByCanonical<T extends ProfileForMatch>(
  profiles: T[],
  plantName: string,
  variety: string | null | undefined
): T | null {
  const name = (plantName ?? "").trim() || "Unknown";
  const { coreVariety } = parseVarietyWithModifiers(variety);
  const varietyName = (coreVariety || (variety ?? "").trim()) || "";
  const nameKey = getCanonicalKey(name);
  const varietyKey = getCanonicalKey(varietyName);
  const p = profiles.find(
    (x) =>
      getCanonicalKey(x.name ?? "") === nameKey &&
      getCanonicalKey(x.variety_name ?? "") === varietyKey
  );
  return p ?? null;
}
