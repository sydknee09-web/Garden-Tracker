"use client";

import { Fragment, useMemo, useRef } from "react";
import {
  getZoneGuideEntries,
  getSowMonthsForGuide,
  isGuideCropStartIndoors,
  getGuideHarvestDays,
} from "@/lib/scheduleUtils";
import type { SowMonths } from "@/lib/scheduleUtils";

const SOW_KEYS: (keyof SowMonths)[] = [
  "sow_jan", "sow_feb", "sow_mar", "sow_apr", "sow_may", "sow_jun",
  "sow_jul", "sow_aug", "sow_sep", "sow_oct", "sow_nov", "sow_dec",
];
const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_WIDTH = 28;
const ROW_HEIGHT = 32;
const CROP_COL_WIDTH = 120;
const monthsWidth = 12 * MONTH_WIDTH;

const LEGEND_ITEMS = [
  { color: "bg-sky-300", label: "Start indoors" },
  { color: "bg-emerald-500", label: "Direct / outdoor" },
  { color: "w-2 h-2 rounded-full bg-amber-400 border border-amber-600", label: "Harvest" },
  { color: "w-1 h-3 bg-orange-500", label: "Today" },
] as const;

export function AnnualRoadmapView() {
  const entries = useMemo(() => getZoneGuideEntries(), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const currentMonth = today.getMonth();

  const nowPosition = useMemo(() => {
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), currentMonth + 1, 0).getDate();
    const fraction = dayOfMonth / daysInMonth;
    return (currentMonth + fraction) * MONTH_WIDTH;
  }, [currentMonth]);

  return (
    <div className="space-y-4 mt-3">
      {/* Compact legend under title */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/60">
        {LEGEND_ITEMS.map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`shrink-0 ${color.startsWith("w-") ? color : `w-3 h-3 rounded ${color}`}`} />
            {label}
          </span>
        ))}
      </div>

      <p className="text-sm text-black/60">
        Zone 10b reference: when to start indoors (blue) vs direct/outdoor (green). Vertical line = today.
      </p>

      <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
        <div className="overflow-x-auto relative" ref={scrollRef}>
          <div
            style={{
              minWidth: CROP_COL_WIDTH + monthsWidth,
              display: "grid",
              gridTemplateColumns: `${CROP_COL_WIDTH}px repeat(12, ${MONTH_WIDTH}px)`,
              gridAutoRows: ROW_HEIGHT,
            }}
            className="min-h-0 relative z-[1]"
          >
            {/* Header row: Crop + 12 month letters centered */}
            <div className="sticky left-0 z-10 col-span-1 flex items-center border-r border-b border-black/10 bg-white pl-2 pr-1">
              <span className="text-xs font-medium text-black/50 truncate">Crop</span>
            </div>
            {MONTH_LABELS.map((l, i) => (
              <div
                key={i}
                className="flex items-center justify-center border-b border-black/10 bg-white text-xs font-medium text-black/50"
              >
                {l}
              </div>
            ))}

            {/* Data rows: crop name (sticky) + bar cell spanning 12 cols; zebra + today line in timeline area */}
            {entries.map((crop, rowIndex) => {
              const sow = getSowMonthsForGuide(crop.planting_window);
              const indices = SOW_KEYS.map((_, i) => i).filter((i) => sow[SOW_KEYS[i]!] === true);
              const first = indices[0];
              const last = indices[indices.length - 1];
              const harvestDays = getGuideHarvestDays(crop.days_to_maturity);
              const isIndoor = isGuideCropStartIndoors(crop.sowing_method);
              const startMonth = first != null ? first * MONTH_WIDTH : 0;
              const endMonth = last != null ? (last + 1) * MONTH_WIDTH : 0;
              const width = endMonth - startMonth;
              const isEven = rowIndex % 2 === 0;

              return (
                <Fragment key={crop.name}>
                  <div
                    className={`sticky left-0 z-10 col-span-1 flex items-center border-r border-black/10 pl-2 pr-1 ${isEven ? "bg-white" : "bg-black/[0.03]"}`}
                  >
                    <span className="text-xs font-medium text-black truncate">{crop.name}</span>
                  </div>
                    <div
                      key={`${crop.name}-bar`}
                      className="relative col-span-12 flex items-center"
                      style={{ gridColumn: "2 / -1", minHeight: ROW_HEIGHT }}
                    >
                    <div
                      className={`absolute inset-0 ${isEven ? "bg-white" : "bg-black/[0.03]"}`}
                      aria-hidden
                    />
                    {/* Today line segment in this row (one per row so we never skip any); dashed for segmented look */}
                    <div
                      className="absolute top-0 bottom-0 w-px pointer-events-none z-[1] translate-x-[-50%] border-l border-orange-500 border-dashed"
                      style={{ left: nowPosition }}
                      aria-hidden
                    />
                    <div className="relative flex items-center w-full h-5" style={{ width: monthsWidth }}>
                      {width > 0 && (
                        <div
                          className="absolute h-full rounded overflow-hidden flex z-[2]"
                          style={{ left: startMonth, width, top: 0 }}
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
                          className="absolute w-2 h-2 rounded-full bg-amber-400 border border-amber-600 z-[2]"
                          style={{
                            left: Math.min(last * MONTH_WIDTH + 14, monthsWidth - 8),
                            top: "50%",
                            transform: "translateY(-50%)",
                          }}
                          title={`Harvest ~${harvestDays} days after sowing`}
                        />
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* Footer legend kept for reference when scrolled */}
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
            <span className="w-1 h-3 bg-orange-500" /> Today
          </span>
        </div>
      </div>
    </div>
  );
}
