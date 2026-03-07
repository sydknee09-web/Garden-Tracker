/**
 * Builds the plant_profiles insert payload for review-import save.
 * Extracted so the payload shape and required fields can be unit tested (Law 12, import flows).
 */
import type { ReviewImportItem } from "@/lib/reviewImportStorage";
import { stripHtmlForDisplay } from "@/lib/htmlEntities";
import { parseVarietyWithModifiers } from "@/lib/varietyModifiers";
import { supabase } from "@/lib/supabase";
import { applyZone10bToProfile } from "@/data/zone10b_schedule";
import { compressImage } from "@/lib/compressImage";
import { toCanonicalDisplay } from "@/lib/vendorNormalize";

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
  profile_type?: "seed" | "permanent";
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
  companion_plants?: string[];
  avoid_plants?: string[];
};

/**
 * Build the object to pass to supabase.from("plant_profiles").insert(...).
 * Mirrors the logic in review-import page handleSaveAll for new profiles.
 */
export function buildPlantProfileInsertPayload(
  item: ReviewImportItem,
  zone10b: Zone10bForProfile,
  userId: string,
  todayISO: () => string,
  profileType: "seed" | "permanent" = "seed"
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
    profile_type: profileType,
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
    ...(Array.isArray(item.companion_plants) && item.companion_plants.length > 0 && { companion_plants: item.companion_plants }),
    ...(Array.isArray(item.avoid_plants) && item.avoid_plants.length > 0 && { avoid_plants: item.avoid_plants }),
  };

  return payload;
}

const DOWNLOAD_TIMEOUT_MS = 5_000;

/**
 * Save a single manual-import item (from QuickAddSeed → /vault/import/manual).
 * Creates profile + packet directly, downloads hero URL to storage if present.
 * Returns profileId. Throws on error.
 */
export async function saveManualImportItem(
  item: ReviewImportItem,
  userId: string,
  options?: { ensureStorage?: () => Promise<Response> }
): Promise<string> {
  const name = (item.type ?? "").trim() || "Unknown";
  const zone10b = applyZone10bToProfile(name, {
    sun: item.sun_requirement ?? item.sun ?? null,
    plant_spacing: item.plant_spacing ?? item.spacing ?? null,
    days_to_germination: item.days_to_germination ?? null,
    harvest_days: item.harvest_days ?? null,
  });

  const todayISO = () => new Date().toISOString().slice(0, 10);
  const payload = buildPlantProfileInsertPayload(item, zone10b, userId, todayISO, "seed");

  if (options?.ensureStorage) {
    const res = await options.ensureStorage();
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? "Storage bucket unavailable");
    }
  }

  const { data: newProfile, error: profileErr } = await supabase
    .from("plant_profiles")
    .insert(payload)
    .select("id")
    .single();
  if (profileErr) throw profileErr;
  const profileId = (newProfile as { id: string }).id;

  const { coreVariety, tags: packetTags } = parseVarietyWithModifiers(item.variety);
  const tagsToSave = packetTags?.length ? packetTags : (item.tags ?? []);
  const purchaseDate = (item.purchaseDate ?? "").trim() || todayISO();
  const vendorVal = (item.vendor ?? "").trim()
    ? (toCanonicalDisplay((item.vendor ?? "").trim()) || (item.vendor ?? "").trim())
    : null;
  const priceVal = (item.price ?? "").trim();
  const userNotesVal = (item.user_notes ?? "").trim();

  const { error: packetErr } = await supabase.from("seed_packets").insert({
    plant_profile_id: profileId,
    user_id: userId,
    vendor_name: vendorVal,
    qty_status: 100,
    purchase_date: purchaseDate,
    ...((item.source_url ?? "").trim() && { purchase_url: (item.source_url ?? "").trim() }),
    ...(tagsToSave.length > 0 && { tags: tagsToSave }),
    ...(priceVal && { price: priceVal }),
    ...(userNotesVal && { user_notes: userNotesVal }),
  });
  if (packetErr) throw packetErr;

  await supabase.from("plant_profiles").update({ status: "in_stock" }).eq("id", profileId).eq("user_id", userId);

  const rawHero = (item.stock_photo_url ?? "").trim() || (item.hero_image_url ?? "").trim();
  const shouldDownloadHero = item.useStockPhotoAsHero !== false && rawHero.startsWith("http");
  if (shouldDownloadHero) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
      const imgRes = await fetch(rawHero, { signal: controller.signal });
      clearTimeout(timeout);
      if (imgRes.ok) {
        const blob = await imgRes.blob();
        const file = new File([blob], "hero.jpg", { type: blob.type || "image/jpeg" });
        const { blob: compressedBlob } = await compressImage(file);
        const vendorStr = (item.vendor ?? "").trim();
        const identityKey = (item.identityKey ?? `${name}-${item.variety ?? ""}`).trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
        const sanitizedKey = (vendorStr + "_" + identityKey).toLowerCase().replace(/[^a-z0-9]/g, "_") || `hero-${profileId}`;
        const storagePath = `${userId}/hero-cache/${sanitizedKey}.jpg`;
        const { error: uploadErr } = await supabase.storage.from("journal-photos").upload(storagePath, compressedBlob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: true,
        });
        if (!uploadErr) {
          await supabase
            .from("plant_profiles")
            .update({ hero_image_path: storagePath, hero_image_url: null })
            .eq("id", profileId)
            .eq("user_id", userId);
        }
      }
    } catch {
      // Keep hero_image_url (external) as fallback; non-fatal
    }
  }

  return profileId;
}
