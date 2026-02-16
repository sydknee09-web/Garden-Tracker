"use client";

import { useMemo, useState } from "react";
import {
  getZoneGuideEntries,
  isGuideCropPlantableInMonth,
} from "@/lib/scheduleUtils";
import type { GuideCrop } from "@/lib/scheduleUtils";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthlyPulseView() {
  const entries = useMemo(() => getZoneGuideEntries(), []);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const monthCounts = useMemo(() => {
    const counts: number[] = [];
    for (let m = 0; m < 12; m++) {
      let n = 0;
      for (const crop of entries) {
        if (isGuideCropPlantableInMonth(crop.planting_window, m)) n++;
      }
      counts.push(n);
    }
    return counts;
  }, [entries]);

  const maxCount = Math.max(...monthCounts, 1);

  const cropsForMonth = useMemo(() => {
    if (selectedMonth == null) return [];
    return entries.filter((c) => isGuideCropPlantableInMonth(c.planting_window, selectedMonth));
  }, [entries, selectedMonth]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-black/60">
        Zone 10b reference: tap a month to see what the guide recommends. Reference only.
      </p>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {MONTH_NAMES.map((name, i) => {
          const count = monthCounts[i] ?? 0;
          const intensity = maxCount > 0 ? count / maxCount : 0;
          const isSelected = selectedMonth === i;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedMonth(isSelected ? null : i)}
              className={`min-h-[44px] rounded-xl border text-sm font-medium transition-colors ${
                isSelected
                  ? "bg-emerald-500 text-white border-emerald-600"
                  : intensity > 0.5
                    ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                    : intensity > 0
                      ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                      : "bg-black/5 text-black/50 border-black/10"
              }`}
              aria-pressed={isSelected}
              aria-label={`${name}: ${count} crops`}
            >
              {name}
              <span className="block text-xs opacity-80">{count}</span>
            </button>
          );
        })}
      </div>

      {selectedMonth != null && (
        <section className="rounded-xl border border-black/10 bg-white p-4">
          <h2 className="text-sm font-bold text-black mb-2">
            {MONTH_NAMES[selectedMonth]} — crops in guide
          </h2>
          {cropsForMonth.length === 0 ? (
            <p className="text-sm text-black/50">No crops in the guide for this month.</p>
          ) : (
            <ul className="space-y-1.5">
              {cropsForMonth.map((crop: GuideCrop) => (
                <li key={crop.name} className="text-sm text-black/90">
                  {crop.name}
                  {crop.planting_window && (
                    <span className="text-black/50 ml-1">— {crop.planting_window}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
