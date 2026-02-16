"use client";

import { useMemo } from "react";
import {
  getZoneGuideEntries,
  isGuideCropStartIndoors,
  isGuideCropPlantableInMonth,
} from "@/lib/scheduleUtils";
import type { GuideCrop } from "@/lib/scheduleUtils";

export function ActionNowView() {
  const entries = useMemo(() => getZoneGuideEntries(), []);
  const currentMonth = new Date().getMonth();

  const { indoor, direct } = useMemo(() => {
    const indoorList: GuideCrop[] = [];
    const directList: GuideCrop[] = [];
    for (const crop of entries) {
      if (!isGuideCropPlantableInMonth(crop.planting_window, currentMonth)) continue;
      if (isGuideCropStartIndoors(crop.sowing_method)) indoorList.push(crop);
      else directList.push(crop);
    }
    return { indoor: indoorList, direct: directList };
  }, [entries, currentMonth]);

  const monthName = new Date().toLocaleString("en-US", { month: "long" });

  return (
    <div className="space-y-6">
      <p className="text-sm text-black/60">
        Zone 10b reference: what to start or plant in {monthName}. Reference only — not your vault.
      </p>

      <section>
        <h2 className="text-sm font-bold text-black mb-2 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-sky-400" aria-hidden />
          Start indoors / trays
        </h2>
        {indoor.length === 0 ? (
          <p className="text-sm text-black/50 py-2">No crops in the guide for this month.</p>
        ) : (
          <ul className="space-y-2">
            {indoor.map((crop) => (
              <li
                key={crop.name}
                className="min-h-[44px] flex items-center gap-3 rounded-xl bg-sky-50 border border-sky-100/80 px-4 py-3"
              >
                <span className="font-semibold text-sky-900">{crop.name}</span>
                {crop.planting_window && (
                  <span className="text-xs text-sky-700/80">{crop.planting_window}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold text-black mb-2 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500" aria-hidden />
          Direct to garden
        </h2>
        {direct.length === 0 ? (
          <p className="text-sm text-black/50 py-2">No crops in the guide for this month.</p>
        ) : (
          <ul className="space-y-2">
            {direct.map((crop) => (
              <li
                key={crop.name}
                className="min-h-[44px] flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-100/80 px-4 py-3"
              >
                <span className="font-semibold text-emerald-900">{crop.name}</span>
                {crop.planting_window && (
                  <span className="text-xs text-emerald-700/80">{crop.planting_window}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
