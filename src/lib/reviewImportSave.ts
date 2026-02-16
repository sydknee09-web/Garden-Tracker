/**
 * Builds the plant_profiles insert payload for review-import save.
 * Extracted so the payload shape and required fields can be unit tested (Law 12, import flows).
 */
import type { ReviewImportItem } from "@/lib/reviewImportStorage";
import { stripHtmlForDisplay } from "@/lib/htmlEntities";
import { parseVarietyWithModifiers } from "@/lib/varietyModifiers";

export type Zone10bForProfile = {
  sun: string | null;
  plant_spacing: string | null;
  days_to_germination: string | null;
  harvest_days: number | null;
  sowing_method: string | null;
  planting_window: string | null;
};

export type PlantProfileInsertPayload = {
  user_id: string;
  name: string;
  variety_name: string | null;
  primary_image_path: null;
  hero_image_url: string;
  tags?: string[];
  sun?: string;
  plant_spacing?: string;
  days_to_germination?: string;
  harvest_days?: number;
  sowing_method?: string;
  planting_window?: string;
  botanical_care_notes?: Record<string, unknown>;
  plant_description?: string;
  description_source?: string;
  growing_notes?: string;
};

/**
 * Build the object to pass to supabase.from("plant_profiles").insert(...).
 * Mirrors the logic in review-import page handleSaveAll for new profiles.
 */
export function buildPlantProfileInsertPayload(
  item: ReviewImportItem,
  zone10b: Zone10bForProfile,
  userId: string,
  todayISO: () => string
): PlantProfileInsertPayload {
  const name = stripHtmlForDisplay(item.type ?? "").trim() || "Unknown";
  const varietyName = stripHtmlForDisplay(item.variety ?? "").trim() || null;
  const { coreVariety, tags: packetTags } = parseVarietyWithModifiers(item.variety);
  const coreVarietyName = coreVariety || varietyName;

  const researchSun = ((item.sun_requirement ?? "").trim() || zone10b.sun) ?? undefined;
  const researchSpacing = ((item.spacing ?? "").trim() || zone10b.plant_spacing) ?? undefined;
  const researchGerm = ((item.days_to_germination ?? "").trim() || zone10b.days_to_germination) ?? undefined;
  const maturityStr = (item.days_to_maturity ?? "").trim();
  const firstNum = maturityStr.match(/\d+/);
  const harvestDaysFromResearch = firstNum ? parseInt(firstNum[0], 10) : undefined;
  const harvestDays = zone10b.harvest_days ?? harvestDaysFromResearch ?? undefined;

  const careNotes: Record<string, unknown> = {};
  if ((item.sowing_depth ?? "").trim()) careNotes.sowing_depth = item.sowing_depth!.trim();
  if ((item.source_url ?? "").trim()) careNotes.source_url = item.source_url!.trim();

  const rawHeroNew = (item.stock_photo_url ?? "").trim() || (item.hero_image_url ?? "").trim();
  const heroUrlForNew =
    item.useStockPhotoAsHero !== false && rawHeroNew ? rawHeroNew : "/seedling-icon.svg";

  const payload: PlantProfileInsertPayload = {
    user_id: userId,
    name,
    variety_name: coreVarietyName || varietyName,
    primary_image_path: null,
    hero_image_url: heroUrlForNew,
    tags: item.tags?.length ? item.tags : undefined,
    ...(researchSun && { sun: researchSun }),
    ...(researchSpacing && { plant_spacing: researchSpacing }),
    ...(researchGerm && { days_to_germination: researchGerm }),
    ...(harvestDays != null && { harvest_days: harvestDays }),
    ...(zone10b.sowing_method && { sowing_method: zone10b.sowing_method }),
    ...(zone10b.planting_window && { planting_window: zone10b.planting_window }),
    ...(Object.keys(careNotes).length > 0 && { botanical_care_notes: careNotes }),
    ...((item.plant_description ?? "").trim() && {
      plant_description: item.plant_description!.trim(),
      description_source: "vendor",
    }),
    ...((item.growing_notes ?? "").trim() && { growing_notes: item.growing_notes!.trim() }),
  };

  return payload;
}
