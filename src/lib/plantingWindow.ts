/**
 * Planting window utilities: profile-based scheduling with Zone 10b fallback.
 *
 * TODO: Zone-aware scheduling. user_settings.planting_zone is stored but not used.
 * All scheduling currently uses Zone 10b fallback.
 */

import {
  getZone10bScheduleForPlant,
  getDefaultSowMonthsForZone10b,
  type SowMonths,
} from "@/data/zone10b_schedule";

const MONTH_ABBREV = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const SOW_KEYS: (keyof SowMonths)[] = [
  "sow_jan", "sow_feb", "sow_mar", "sow_apr", "sow_may", "sow_jun",
  "sow_jul", "sow_aug", "sow_sep", "sow_oct", "sow_nov", "sow_dec",
];

export type ProfileForPlantingWindow = {
  name?: string | null;
  planting_window?: string | null;
};

/**
 * Returns sow months (sow_jan..sow_dec) for a profile.
 * Uses profile.planting_window if set, else zone10b fallback by first word of name.
 */
export function getSowMonthsForProfile(profile: ProfileForPlantingWindow): SowMonths {
  const window = profile.planting_window?.trim();
  if (window) return getDefaultSowMonthsForZone10b(window);

  const name = (profile.name ?? "").trim();
  const firstWord = name.split(/\s+/)[0]?.trim();
  const zone10b = getZone10bScheduleForPlant(firstWord ?? name);
  return getDefaultSowMonthsForZone10b(zone10b?.planting_window);
}

/**
 * Returns true if the profile is plantable in the given month (0-based index).
 */
export function isPlantableInMonth(
  profile: ProfileForPlantingWindow,
  monthIndex: number,
  _year?: number
): boolean {
  const sow = getSowMonthsForProfile(profile);
  const key = SOW_KEYS[monthIndex];
  return key ? sow[key] === true : false;
}

/**
 * Returns a human-readable sowing window label for display.
 * Uses profile.planting_window, zone10b fallback, or derives from sow months.
 */
export function getSowingWindowLabel(profile: ProfileForPlantingWindow): string | null {
  const window = profile.planting_window?.trim();
  if (window) return window;

  const name = (profile.name ?? "").trim();
  const firstWord = name.split(/\s+/)[0]?.trim();
  const zone10b = getZone10bScheduleForPlant(firstWord ?? name);
  if (zone10b?.planting_window?.trim()) return zone10b.planting_window.trim();

  const sow = getSowMonthsForProfile(profile);
  const indices = SOW_KEYS.map((_, i) => i).filter((i) => sow[SOW_KEYS[i]!] === true);
  if (indices.length === 0) return null;

  const runs: number[][] = [];
  let run: number[] = [indices[0]!];
  for (let i = 1; i < indices.length; i++) {
    if (indices[i]! === indices[i - 1]! + 1) run.push(indices[i]!);
    else {
      runs.push(run);
      run = [indices[i]!];
    }
  }
  runs.push(run);
  return runs
    .map((r) =>
      r.length >= 2 ? `${MONTH_ABBREV[r[0]!]}–${MONTH_ABBREV[r[r.length - 1]!]}` : MONTH_ABBREV[r[0]!]
    )
    .join(", ");
}
