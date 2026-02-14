/**
 * Hierarchy of Truth for plant care display:
 * 1. User Overrides (seed_packets.user_notes) — when present, can override display
 * 2. Perenual API (plant_profiles.botanical_care_notes)
 * 3. Zone 10b static schedule (fallback for sun, spacing, germination, harvest)
 * 4. Raw Scraper Data (profile fields)
 */

export type ScheduleDefaultLike = {
  sun?: string | null;
  plant_spacing?: string | null;
  spacing?: string | null;
  water?: string | null;
  sowing_depth?: string | null;
  days_to_germination?: string | null;
  germination_time?: string | null;
  harvest_days?: number | null;
  days_to_maturity?: string | null;
};

export type BotanicalCareNotesLike = {
  sunlight?: string[] | null;
  watering?: string | null;
  cycle?: string | null;
  [key: string]: unknown;
};

export type ProfileCareLike = {
  sun?: string | null;
  water?: string | null;
  plant_spacing?: string | null;
  sowing_depth?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
  botanical_care_notes?: BotanicalCareNotesLike | null;
};

export type EffectiveCare = {
  sun: string | null;
  water: string | null;
  plant_spacing: string | null;
  sowing_depth: string | null;
  days_to_germination: string | null;
  harvest_days: number | null;
};

function orNull(s: unknown): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t || null;
}

function orNum(n: unknown): number | null {
  if (n == null) return null;
  if (typeof n === "number" && !Number.isNaN(n)) return n;
  const parsed = parseInt(String(n), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Resolve care fields by hierarchy: Perenual (botanical_care_notes) > zone10b schedule > profile (scraper).
 * Optional packet.user_notes is not merged into structured fields here; display it separately as "Your notes".
 */
export function getEffectiveCare(
  profile: ProfileCareLike,
  schedule?: ScheduleDefaultLike | null,
  _packet?: { user_notes?: string | null } | null
): EffectiveCare {
  const perenual = profile.botanical_care_notes;
  const sunFromPerenual =
    Array.isArray(perenual?.sunlight) && perenual.sunlight.length > 0
      ? perenual.sunlight[0]
      : null;
  const sun = orNull(sunFromPerenual ?? schedule?.sun ?? profile.sun);
  const water = orNull(perenual?.watering ?? schedule?.water ?? profile.water);
  const spacing = orNull(schedule?.plant_spacing ?? schedule?.spacing ?? profile.plant_spacing);
  const sowingDepth = orNull(schedule?.sowing_depth ?? profile.sowing_depth);
  const germ = orNull(
    schedule?.days_to_germination ?? schedule?.germination_time ?? profile.days_to_germination
  );
  const harvest =
    orNum(profile.harvest_days) ??
    orNum(schedule?.harvest_days) ??
    (schedule?.days_to_maturity ? parseInt(String(schedule.days_to_maturity).replace(/\D/g, ""), 10) : null);
  return {
    sun,
    water,
    plant_spacing: spacing,
    sowing_depth: sowingDepth,
    days_to_germination: germ,
    harvest_days: harvest ?? null,
  };
}
