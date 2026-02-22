/**
 * Enrich an existing plant profile from name + variety.
 * Calls enrich-from-name and find-hero-photo, applies updates.
 * Fill-only-when-empty for growing_notes; never overwrites user-provided data.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "@/lib/identityKey";

export type EnrichProfileFromNameOptions = {
  vendor?: string;
  /** When true, skip find-hero-photo (e.g. user already uploaded photos). */
  skipHero?: boolean;
  /** Only set growing_notes from AI when this is empty. */
  existingGrowingNotes?: string | null;
  /** For API usage logging and find-hero-photo cache. */
  accessToken?: string | null;
};

export type EnrichProfileFromNameResult = {
  enriched: boolean;
  heroSet: boolean;
};

type EnrichFromNameResponse = {
  enriched?: boolean;
  sun?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
  sowing_depth?: string | null;
  sowing_method?: string | null;
  planting_window?: string | null;
  water?: string | null;
  source_url?: string | null;
  plant_description?: string | null;
  growing_notes?: string | null;
};

function authHeaders(accessToken?: string | null): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken?.trim()) h["Authorization"] = `Bearer ${accessToken.trim()}`;
  return h;
}

/**
 * Enrich an existing plant profile from name + variety.
 * Updates plant_profiles only; does not touch grow_instances, journal_entries, tasks.
 */
export async function enrichProfileFromName(
  supabase: SupabaseClient,
  profileId: string,
  userId: string,
  name: string,
  variety: string,
  options: EnrichProfileFromNameOptions = {}
): Promise<EnrichProfileFromNameResult> {
  const { vendor = "", skipHero = false, existingGrowingNotes, accessToken } = options;
  const varietyTrim = (variety ?? "").trim();
  let enriched = false;
  let heroSet = false;

  const enrichRes = await fetch("/api/seed/enrich-from-name", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ name: (name ?? "").trim(), variety: varietyTrim }),
  });
  const enrichData = (await enrichRes.json()) as EnrichFromNameResponse;

  if (enrichData.enriched) {
    enriched = true;
    const updates: Record<string, unknown> = {};
    if (enrichData.sun != null) updates.sun = enrichData.sun;
    if (enrichData.plant_spacing != null) updates.plant_spacing = enrichData.plant_spacing;
    if (enrichData.days_to_germination != null) updates.days_to_germination = enrichData.days_to_germination;
    if (enrichData.harvest_days != null) updates.harvest_days = enrichData.harvest_days;
    if (enrichData.sowing_depth != null) updates.sowing_method = enrichData.sowing_depth;
    if (enrichData.sowing_method != null) updates.sowing_method = enrichData.sowing_method;
    if (enrichData.planting_window != null) updates.planting_window = enrichData.planting_window;
    if (enrichData.water != null) updates.water = enrichData.water;
    if (enrichData.plant_description != null) updates.plant_description = enrichData.plant_description;

    if (enrichData.growing_notes != null && !(existingGrowingNotes ?? "").trim()) {
      updates.growing_notes = enrichData.growing_notes;
    }

    if (enrichData.source_url != null) {
      const { data: existing } = await supabase
        .from("plant_profiles")
        .select("botanical_care_notes")
        .eq("id", profileId)
        .eq("user_id", userId)
        .single();
      const existingCare = (existing as { botanical_care_notes?: Record<string, unknown> | null } | null)
        ?.botanical_care_notes ?? {};
      updates.botanical_care_notes = { ...existingCare, source_url: enrichData.source_url };
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from("plant_profiles")
        .update(updates)
        .eq("id", profileId)
        .eq("user_id", userId);
    }
  }

  if (!skipHero) {
    const idKey = identityKeyFromVariety(name, varietyTrim);
    const heroRes = await fetch("/api/seed/find-hero-photo", {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify({
        name: (name ?? "").trim(),
        variety: varietyTrim,
        vendor: (vendor ?? "").trim(),
        identity_key: idKey || undefined,
        profile_id: profileId,
      }),
    });
    const heroData = (await heroRes.json()) as { hero_image_url?: string; hero_image_path?: string; error?: string };
    const heroUrl = heroData.hero_image_url?.trim();
    const heroPath = heroData.hero_image_path?.trim();
    if (heroPath) {
      await supabase
        .from("plant_profiles")
        .update({ hero_image_path: heroPath, hero_image_url: null })
        .eq("id", profileId)
        .eq("user_id", userId);
      heroSet = true;
    } else if (heroUrl && heroUrl.startsWith("http")) {
      await supabase
        .from("plant_profiles")
        .update({ hero_image_url: heroUrl })
        .eq("id", profileId)
        .eq("user_id", userId);
      heroSet = true;
    }
  }

  return { enriched, heroSet };
}
