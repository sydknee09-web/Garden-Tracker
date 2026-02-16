"use client";

import { useMemo, useRef, useState } from "react";
import {
  getZoneGuideEntries,
  getSowMonthsForGuide,
  isGuideCropStartIndoors,
  getGuideHarvestDays,
} from "@/lib/scheduleUtils";
import type { GuideCrop } from "@/lib/scheduleUtils";
import type { SowMonths } from "@/lib/scheduleUtils";

const SOW_KEYS: (keyof SowMonths)[] = [
  "sow_jan", "sow_feb", "sow_mar", "sow_apr", "sow_may", "sow_jun",
  "sow_jul", "sow_aug", "sow_sep", "sow_oct", "sow_nov", "sow_dec",
];
const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function AnnualRoadmapView() {
  const entries = useMemo(() => getZoneGuideEntries(), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const currentMonth = today.getMonth();
  const monthsWidth = 12 * 28;

  const nowPosition = useMemo(() => {
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), currentMonth + 1, 0).getDate();
    const fraction = dayOfMonth / daysInMonth;
    return (currentMonth + fraction) * 28;
  }, [currentMonth]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-black/60">
        Zone 10b reference: when to start indoors (blue) vs direct/outdoor (green). Vertical line = today.
      </p>

      <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
        <div className="overflow-x-auto" ref={scrollRef}>
          <div style={{ minWidth: 200 + monthsWidth }} className="flex">
            <div className="sticky left-0 z-10 w-[120px] shrink-0 bg-white border-r border-black/10 py-2 pl-2">
              <div className="h-6 text-xs font-medium text-black/50">Crop</div>
            </div>
            <div className="relative flex-1 py-2 pr-2">
              <div className="flex gap-0" style={{ width: monthsWidth }}>
                {MONTH_LABELS.map((l, i) => (
                  <div
                    key={i}
                    className="shrink-0 w-7 text-center text-xs font-medium text-black/50"
                    style={{ width: 28 }}
                  >
                    {l}
                  </div>
                ))}
              </div>

              {/* Now line */}
              <div
                className="absolute top-0 bottom-2 w-0.5 bg-orange-500 z-20 pointer-events-none"
                style={{ left: nowPosition }}
              />

              <div className="mt-1 space-y-1 max-h-[60vh] overflow-y-auto">
                {entries.slice(0, 24).map((crop) => {
                  const sow = getSowMonthsForGuide(crop.planting_window);
                  const indices = SOW_KEYS.map((_, i) => i).filter((i) => sow[SOW_KEYS[i]!] === true);
                  const first = indices[0];
                  const last = indices[indices.length - 1];
                  const harvestDays = getGuideHarvestDays(crop.days_to_maturity);
                  const isIndoor = isGuideCropStartIndoors(crop.sowing_method);
                  const startMonth = first != null ? first * 28 : 0;
                  const endMonth = last != null ? (last + 1) * 28 : 0;
                  const width = endMonth - startMonth;

                  return (
                    <div key={crop.name} className="flex items-center gap-0 min-h-[36px]">
                      <div className="sticky left-0 z-10 w-[120px] shrink-0 bg-white pl-1 pr-2 py-0.5">
                        <span className="text-xs font-medium text-black truncate block">
                          {crop.name}
                        </span>
                      </div>
                      <div className="relative flex gap-0" style={{ width: monthsWidth, height: 24 }}>
                        {width > 0 && (
                          <div
                            className="absolute h-full rounded overflow-hidden flex"
                            style={{ left: startMonth, width }}
                          >
                            {isIndoor ? (
                              <>
                                <div
                                  className="h-full bg-sky-300 min-w-[20%]"
                                  style={{ width: "40%" }}
                                />
                                <div
                                  className="h-full bg-emerald-400"
                                  style={{ width: "60%" }}
                                />
                              </>
                            ) : (
                              <div className="h-full bg-emerald-500 w-full" />
                            )}
                          </div>
                        )}
                        {harvestDays != null && last != null && (
                          <div
                            className="absolute w-2 h-2 rounded-full bg-amber-400 border border-amber-600"
                            style={{
                              left: Math.min(last * 28 + 14, monthsWidth - 8),
                              top: 6,
                            }}
                            title={`Harvest ~${harvestDays} days after sowing`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-t border-black/10 bg-black/[0.02] flex flex-wrap gap-4 text-xs text-black/60">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-sky-300" /> Start indoors
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500" /> Direct / outdoor
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 border border-amber-600" /> Harvest
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-0.5 h-3 bg-orange-500" /> Today
          </span>
        </div>
      </div>
    </div>
  );
}
