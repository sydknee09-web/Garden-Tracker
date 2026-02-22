/**
 * Build base insert payload for plant_profiles from name + variety only.
 * Matches link-import shape: tags (modifier + 11 functional), coreVariety, profile_type.
 * Callers merge in flow-specific fields (purchase_date, growing_notes, etc.).
 */
import { parseVarietyWithModifiers } from "@/lib/varietyModifiers";
import { getTagsFromText } from "@/lib/parseSeedFromImportUrl";

export type BuildProfileInsertFromNameOptions = {
  /** DB value: "seed" or "permanent". Caller maps UI "seasonal" -> "seed". */
  profileType?: "seed" | "permanent";
  /** Default "active" for AddPlantModal; "out_of_stock" for QuickAddSeed; "in_stock" for vault plant. */
  status?: string;
  /** User-blocked tags from Settings; filters before returning. */
  blockedTags?: Set<string> | null;
};

export type PlantProfileInsertBase = {
  user_id: string;
  name: string;
  variety_name: string | null;
  profile_type: "seed" | "permanent";
  status: string;
  tags?: string[];
};

/**
 * Build base insert payload for plant_profiles from name + variety.
 * Uses parseVarietyWithModifiers (F1, Organic, etc.) + getTagsFromText (11 functional tags).
 */
export function buildProfileInsertFromName(
  name: string,
  variety: string | null,
  userId: string,
  options: BuildProfileInsertFromNameOptions = {}
): PlantProfileInsertBase {
  const { profileType = "seed", status = "active", blockedTags } = options;
  const nameTrim = (name ?? "").trim();
  const varietyTrim = (variety ?? "").trim() || null;

  const { coreVariety, tags: modifierTags } = parseVarietyWithModifiers(varietyTrim);
  const coreVarietyName = coreVariety || varietyTrim || null;

  const combinedText = [nameTrim, varietyTrim].filter(Boolean).join(" ");
  const functionalTags = getTagsFromText(combinedText);

  const allTags = [...new Set([...modifierTags, ...functionalTags])];
  let tagsFiltered = allTags;
  if (blockedTags?.size) {
    tagsFiltered = allTags.filter((t) => {
      const s = String(t).trim();
      return s && !blockedTags.has(s);
    });
  }

  return {
    user_id: userId,
    name: nameTrim,
    variety_name: coreVarietyName,
    profile_type: profileType,
    status,
    ...(tagsFiltered.length > 0 && { tags: tagsFiltered }),
  };
}
