/**
 * Schedule view helpers: zone planting guide only (reference, no vault).
 * Data source: zone10b_schedule.ts (SDSC-style Zones 9/10 reference guide).
 */

import {
  ZONE_10B_SCHEDULE,
  getDefaultSowMonthsForZone10b,
  type PlantingData,
  type SowMonths,
} from "@/data/zone10b_schedule";

const SOW_KEYS: (keyof SowMonths)[] = [
  "sow_jan", "sow_feb", "sow_mar", "sow_apr", "sow_may", "sow_jun",
  "sow_jul", "sow_aug", "sow_sep", "sow_oct", "sow_nov", "sow_dec",
];

/** One crop entry in the zone planting guide (for schedule reference views). */
export type GuideCrop = { name: string } & PlantingData;

/** All zone guide entries for the schedule. Sorted by name for stable display. */
export function getZoneGuideEntries(): GuideCrop[] {
  return Object.entries(ZONE_10B_SCHEDULE)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** True if sowing_method indicates start indoors / transplant (vs direct sow). */
export function isGuideCropStartIndoors(sowing_method: string | undefined): boolean {
  if (!sowing_method?.trim()) return false;
  const m = sowing_method.toLowerCase();
  return m.includes("indoor") || m.includes("transplant") || m.includes("tray") || m.includes("seedling");
}

/** Parse days_to_maturity string (e.g. "75-90 days") to a number for harvest estimate. */
export function getGuideHarvestDays(days_to_maturity: string | undefined): number | null {
  if (!days_to_maturity?.trim()) return null;
  const range = days_to_maturity.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return Math.round((parseInt(range[1], 10) + parseInt(range[2], 10)) / 2);
  const single = days_to_maturity.match(/(\d+)/);
  return single ? parseInt(single[1], 10) : null;
}

/** Sow months for a guide entry (from planting_window). */
export function getSowMonthsForGuide(planting_window: string | undefined): SowMonths {
  return getDefaultSowMonthsForZone10b(planting_window);
}

/** True if the guide crop is plantable in the given month (0-based index). */
export function isGuideCropPlantableInMonth(
  planting_window: string | undefined,
  monthIndex: number
): boolean {
  const sow = getDefaultSowMonthsForZone10b(planting_window);
  const key = SOW_KEYS[monthIndex];
  return key ? sow[key] === true : false;
}

export { type SowMonths } from "@/data/zone10b_schedule";
