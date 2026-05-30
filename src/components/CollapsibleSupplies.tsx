"use client";

import { useId, useState } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import { SupplyPicker } from "@/components/SupplyPicker";

/**
 * Collapsible wrapper around SupplyPicker for use across plant-add flows.
 * Default-closed for progressive disclosure (supplies is power-user data).
 * Shared between AddPlantModal (Manual + Established) and PlantingForm (From Vault)
 * so Supplies treatment stays consistent — see CLAUDE.md cohesion-by-aggregation rule.
 */
export function CollapsibleSupplies({
  selectedIds,
  onChange,
}: {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const bodyId = useId();
  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 min-h-[44px] px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-50"
        aria-expanded={isOpen}
        aria-controls={bodyId}
      >
        <span>Supplies used (optional)</span>
        {isOpen ? (
          <ICON_MAP.ChevronUp className="w-4 h-4 shrink-0" />
        ) : (
          <ICON_MAP.ChevronDown className="w-4 h-4 shrink-0" />
        )}
      </button>
      {isOpen && (
        <div id={bodyId} className="mt-2">
          <SupplyPicker
            selectedIds={selectedIds}
            onChange={onChange}
            label=""
            placeholder="Tap any supplies used at planting"
          />
        </div>
      )}
    </div>
  );
}
