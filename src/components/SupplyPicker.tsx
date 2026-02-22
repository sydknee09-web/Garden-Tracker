"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import type { SupplyProfile } from "@/types/garden";

const CATEGORY_LABELS: Record<string, string> = {
  fertilizer: "Fertilizer",
  pesticide: "Pesticide",
  soil_amendment: "Soil Amendment",
  other: "Other",
};

export function SupplyPicker({
  selectedIds,
  onChange,
  label = "Supplies used (optional)",
  placeholder = "e.g. seed starter, fertilizer at sowing",
}: {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  label?: string;
  placeholder?: string;
}) {
  const { user } = useAuth();
  const { viewMode: householdViewMode } = useHousehold();
  const [supplies, setSupplies] = useState<SupplyProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const isFamilyView = householdViewMode === "family";

  const fetchSupplies = useCallback(async () => {
    if (!user?.id) {
      setSupplies([]);
      setLoading(false);
      return;
    }
    let query = supabase
      .from("supply_profiles")
      .select("id, name, brand, category")
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (!isFamilyView) query = query.eq("user_id", user.id);
    const { data, error } = await query;
    setSupplies((data ?? []) as SupplyProfile[]);
    setLoading(false);
  }, [user?.id, isFamilyView]);

  useEffect(() => {
    fetchSupplies();
  }, [fetchSupplies]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange(next);
    },
    [selectedIds, onChange]
  );

  if (loading || supplies.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-black/60">{label}</span>
      <p className="text-xs text-black/50">{placeholder}</p>
      <div className="flex flex-wrap gap-2">
        {supplies.map((s) => {
          const checked = selectedIds.has(s.id);
          const displayName = s.brand?.trim() ? `${s.name} (${s.brand})` : s.name;
          const categoryLabel = CATEGORY_LABELS[s.category] ?? s.category;
          return (
            <label
              key={s.id}
              className={`flex items-center gap-1.5 cursor-pointer min-h-[44px] px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                checked
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-black/10 text-black/70 hover:bg-black/5"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(s.id)}
                className="rounded border-gray-400 text-emerald-600 focus:ring-emerald-500"
                aria-label={`Select ${displayName}`}
              />
              <span className="truncate max-w-[140px]" title={displayName}>
                {displayName}
              </span>
              <span className="text-[10px] text-black/50 shrink-0">{categoryLabel}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
