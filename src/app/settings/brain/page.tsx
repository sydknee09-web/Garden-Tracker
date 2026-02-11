"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const MONTH_COLS = [
  "sow_jan", "sow_feb", "sow_mar", "sow_apr", "sow_may", "sow_jun",
  "sow_jul", "sow_aug", "sow_sep", "sow_oct", "sow_nov", "sow_dec",
] as const;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type BrainRow = {
  id: string;
  plant_type: string;
  sun: string | null;
  water: string | null;
  plant_spacing: string | null;
  sowing_depth: string | null;
  sow_jan: boolean;
  sow_feb: boolean;
  sow_mar: boolean;
  sow_apr: boolean;
  sow_may: boolean;
  sow_jun: boolean;
  sow_jul: boolean;
  sow_aug: boolean;
  sow_sep: boolean;
  sow_oct: boolean;
  sow_nov: boolean;
  sow_dec: boolean;
};

export default function BrainEditorPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BrainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [careDraft, setCareDraft] = useState<{ sun: string; water: string; plant_spacing: string; sowing_depth: string } | null>(null);
  const [savingCare, setSavingCare] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("schedule_defaults")
      .select("id, plant_type, sun, water, plant_spacing, sowing_depth, sow_jan, sow_feb, sow_mar, sow_apr, sow_may, sow_jun, sow_jul, sow_aug, sow_sep, sow_oct, sow_nov, sow_dec")
      .eq("user_id", user.id)
      .order("plant_type", { ascending: true });
    if (!error && data) setRows((data ?? []) as BrainRow[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleMonth = useCallback(async (rowId: string, col: (typeof MONTH_COLS)[number]) => {
    if (!user?.id) return;
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const next = !row[col];
    const cellKey = `${rowId}-${col}`;
    setUpdating(cellKey);
    const { error } = await supabase
      .from("schedule_defaults")
      .update({ [col]: next, updated_at: new Date().toISOString() })
      .eq("id", rowId)
      .eq("user_id", user.id);
    if (!error) {
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, [col]: next } : r))
      );
    }
    setUpdating(null);
  }, [user?.id, rows]);

  const openCare = useCallback((row: BrainRow) => {
    setExpandedId(row.id);
    setCareDraft({
      sun: row.sun ?? "",
      water: row.water ?? "",
      plant_spacing: row.plant_spacing ?? "",
      sowing_depth: row.sowing_depth ?? "",
    });
  }, []);

  const closeCare = useCallback(() => {
    setExpandedId(null);
    setCareDraft(null);
  }, []);

  const saveCare = useCallback(async () => {
    if (!user?.id || !expandedId || !careDraft) return;
    setSavingCare(expandedId);
    const { error } = await supabase
      .from("schedule_defaults")
      .update({
        sun: careDraft.sun.trim() || null,
        water: careDraft.water.trim() || null,
        plant_spacing: careDraft.plant_spacing.trim() || null,
        sowing_depth: careDraft.sowing_depth.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", expandedId)
      .eq("user_id", user.id);
    if (!error) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === expandedId
            ? {
                ...r,
                sun: careDraft.sun.trim() || null,
                water: careDraft.water.trim() || null,
                plant_spacing: careDraft.plant_spacing.trim() || null,
                sowing_depth: careDraft.sowing_depth.trim() || null,
              }
            : r
        )
      );
      closeCare();
    }
    setSavingCare(null);
  }, [user?.id, expandedId, careDraft, closeCare]);

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <Link href="/settings" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6">
        ← Settings
      </Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Brain Editor</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Check the months when each plant type is “sow now.” Expand a row to set default care (Sun, Water, Spacing, Sowing Depth) used when Perenual API has no data.
      </p>

      {loading ? (
        <p className="text-neutral-500 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-neutral-500 text-sm">No plant types in the Brain yet. Add seeds via Import and save new types to the Brain, or they’ll appear here when added.</p>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 rounded-xl bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left font-semibold text-neutral-700 p-2 sticky left-0 bg-neutral-50 z-10 min-w-[120px]">
                  Plant type
                </th>
                <th className="w-10" aria-label="Care defaults" />
                {MONTH_LABELS.map((label) => (
                  <th key={label} className="text-center font-semibold text-neutral-600 p-1 w-[44px] min-w-[44px]">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-neutral-100 hover:bg-neutral-50/50">
                    <td className="p-2 sticky left-0 bg-white hover:bg-neutral-50/50 z-10 font-medium text-neutral-900">
                      {row.plant_type}
                    </td>
                    <td className="p-1 align-middle">
                      <button
                        type="button"
                        aria-label={`Care defaults for ${row.plant_type}`}
                        aria-expanded={expandedId === row.id}
                        onClick={() => (expandedId === row.id ? closeCare() : openCare(row))}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg border border-neutral-300 flex items-center justify-center text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 touch-manipulation"
                      >
                        {expandedId === row.id ? "−" : "+"}
                      </button>
                    </td>
                    {MONTH_COLS.map((col) => {
                      const cellKey = `${row.id}-${col}`;
                      const busy = updating === cellKey;
                      return (
                        <td key={col} className="p-1 text-center align-middle">
                          <button
                            type="button"
                            aria-label={`${row.plant_type} sow in ${col.replace("sow_", "")}`}
                            disabled={busy}
                            onClick={() => toggleMonth(row.id, col)}
                            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:opacity-50 touch-manipulation"
                            style={{
                              backgroundColor: row[col] ? "rgb(16 185 129)" : "transparent",
                              borderColor: row[col] ? "rgb(16 185 129)" : "rgb(229 231 235)",
                            }}
                          >
                            {row[col] ? (
                              <span className="text-white text-lg leading-none" aria-hidden>✓</span>
                            ) : null}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                  {expandedId === row.id && careDraft && (
                    <tr key={`${row.id}-care`} className="bg-neutral-50 border-b border-neutral-200">
                      <td colSpan={2 + MONTH_COLS.length} className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                          <div>
                            <label htmlFor="brain-sun" className="block text-xs font-medium text-neutral-600 mb-1">Sun</label>
                            <input
                              id="brain-sun"
                              type="text"
                              value={careDraft.sun}
                              onChange={(e) => setCareDraft((d) => d ? { ...d, sun: e.target.value } : null)}
                              placeholder="e.g. Full Sun"
                              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label htmlFor="brain-water" className="block text-xs font-medium text-neutral-600 mb-1">Water</label>
                            <input
                              id="brain-water"
                              type="text"
                              value={careDraft.water}
                              onChange={(e) => setCareDraft((d) => d ? { ...d, water: e.target.value } : null)}
                              placeholder="e.g. Average"
                              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label htmlFor="brain-spacing" className="block text-xs font-medium text-neutral-600 mb-1">Spacing</label>
                            <input
                              id="brain-spacing"
                              type="text"
                              value={careDraft.plant_spacing}
                              onChange={(e) => setCareDraft((d) => d ? { ...d, plant_spacing: e.target.value } : null)}
                              placeholder="e.g. 24-36 inches"
                              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label htmlFor="brain-depth" className="block text-xs font-medium text-neutral-600 mb-1">Sowing depth</label>
                            <input
                              id="brain-depth"
                              type="text"
                              value={careDraft.sowing_depth}
                              onChange={(e) => setCareDraft((d) => d ? { ...d, sowing_depth: e.target.value } : null)}
                              placeholder="e.g. 1/4 inch"
                              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={saveCare}
                            disabled={savingCare === row.id}
                            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {savingCare === row.id ? "Saving…" : "Save care defaults"}
                          </button>
                          <button
                            type="button"
                            onClick={closeCare}
                            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
