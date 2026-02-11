import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlantingData } from "@/data/zone10b_schedule";
import { toScheduleKey } from "@/data/zone10b_schedule";

type ScheduleDefaultRow = {
  plant_type: string;
  sun: string | null;
  water: string | null;
  plant_spacing: string | null;
  sowing_depth: string | null;
  sowing_method: string | null;
  planting_window: string | null;
  days_to_germination: string | null;
  harvest_days: number | null;
};

/**
 * Fetch the current user's schedule_defaults and return a map keyed by title-case plant_type for hybrid lookup.
 */
export async function fetchScheduleDefaults(
  supabase: SupabaseClient
): Promise<Record<string, PlantingData>> {
  const { data: rows, error } = await supabase
    .from("schedule_defaults")
    .select("plant_type, sun, water, plant_spacing, sowing_depth, sowing_method, planting_window, days_to_germination, harvest_days");

  if (error || !rows) return {};
  const map: Record<string, PlantingData> = {};
  for (const row of rows as ScheduleDefaultRow[]) {
    const key = toScheduleKey(row.plant_type || "");
    if (!key) continue;
    map[key] = {
      sun: row.sun ?? undefined,
      water: row.water ?? undefined,
      spacing: row.plant_spacing ?? undefined,
      sowing_depth: row.sowing_depth ?? undefined,
      sowing_method: row.sowing_method ?? "",
      planting_window: row.planting_window ?? "",
      germination_time: row.days_to_germination ?? undefined,
      days_to_maturity: row.harvest_days != null ? `${row.harvest_days} days` : undefined,
    };
  }
  return map;
}
