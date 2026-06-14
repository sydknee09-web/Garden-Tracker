"use client";

import type { VaultSortBy } from "@/types/vault";
import { useState } from "react";
import type { UseFilterStateReturn } from "@/hooks/useFilterState";
import { getTagStyle } from "@/components/TagBadges";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { FilterChipGroup } from "@/components/FilterChipRow";
import { SearchableMultiSelect } from "@/components/SearchableMultiSelect";
import { isSeedTypeTag } from "@/constants/seedTypes";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type GridRefineSection =
  | "plantCategory"
  | "plantName"
  | "plantMonth"
  | "inventory"
  | "sort"
  | "tags"
  | "vendor"
  | "variety"
  | "sun"
  | "spacing"
  | "germination"
  | "maturity"
  | "packetCount"
  | "method"
  | null;

export type RefineChips = {
  variety: { value: string; count: number }[];
  vendor: { value: string; count: number }[];
  sun: { value: string; count: number }[];
  spacing: { value: string; count: number }[];
  germination: { value: string; count: number }[];
  maturity: { value: string; count: number }[];
  packetCount: { value: string; count: number }[];
  method: { value: string; count: number }[];
};

export interface VaultGridRefineModalProps {
  open: boolean;
  onClose: () => void;
  refineBySection: GridRefineSection;
  setRefineBySection: React.Dispatch<React.SetStateAction<GridRefineSection>>;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  sortBy: VaultSortBy;
  setSortBy: (v: VaultSortBy) => void;
  sortDirection: "asc" | "desc";
  setSortDirection: (v: "asc" | "desc") => void;
  vaultFilters: UseFilterStateReturn<"vault">;
  plantCategoryChips: { value: string; count: number }[];
  plantNameOptions: string[];
  availableTags: string[];
  refineChips: RefineChips;
  filteredVarietyIds: string[];
}

export function VaultGridRefineModal({
  open,
  onClose,
  refineBySection,
  setRefineBySection,
  hasActiveFilters,
  clearAllFilters,
  sortBy,
  setSortBy,
  sortDirection,
  setSortDirection,
  vaultFilters,
  plantCategoryChips,
  plantNameOptions,
  availableTags,
  refineChips,
  filteredVarietyIds,
}: VaultGridRefineModalProps) {
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  if (!open) return null;

  const sectionOptions = [
    { sortBy: "purchase_date" as const, sortDirection: "desc" as const, label: "Purchase date (newest first)" },
    { sortBy: "purchase_date" as const, sortDirection: "asc" as const, label: "Purchase date (oldest first)" },
    { sortBy: "name" as const, sortDirection: "asc" as const, label: "Name (A–Z)" },
    { sortBy: "name" as const, sortDirection: "desc" as const, label: "Name (Z–A)" },
    { sortBy: "date_added" as const, sortDirection: "desc" as const, label: "Date added (newest first)" },
    { sortBy: "date_added" as const, sortDirection: "asc" as const, label: "Date added (oldest first)" },
    { sortBy: "variety" as const, sortDirection: "asc" as const, label: "Variety (A–Z)" },
    { sortBy: "variety" as const, sortDirection: "desc" as const, label: "Variety (Z–A)" },
    { sortBy: "packet_count" as const, sortDirection: "desc" as const, label: "Packet Count (most first)" },
    { sortBy: "packet_count" as const, sortDirection: "asc" as const, label: "Packet Count (fewest first)" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={onClose} />
      <div
        className="fixed left-4 right-4 top-1/2 z-[101] -translate-y-1/2 rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col max-w-md mx-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refine-by-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-black/10">
          <h2 id="refine-by-title" className="text-lg font-semibold text-black">
            Filter
          </h2>
          <div className="flex items-center gap-1">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                aria-label="Clear All Filters"
              >
                Clear Filters
              </button>
            )}
            <ModalCloseButton onClick={onClose} />
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {plantCategoryChips.length > 0 && (
            <div className="border-b border-black/5">
              <button
                type="button"
                onClick={() => setRefineBySection((s) => (s === "plantCategory" ? null : "plantCategory"))}
                className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                aria-expanded={refineBySection === "plantCategory"}
              >
                <span>Category</span>
                <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                  {refineBySection === "plantCategory" ? "▼" : "▸"}
                </span>
              </button>
              {refineBySection === "plantCategory" && (
                <div className="px-4 pb-3 pt-0">
                  <div className="flex flex-wrap gap-2">
                    <FilterChipGroup
                      chips={plantCategoryChips}
                      selected={vaultFilters.filters.plantCategory}
                      onSelect={vaultFilters.setPlantCategory}
                      ariaLabelPrefix="Filter by category"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Plant Name */}
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setRefineBySection((s) => (s === "plantName" ? null : "plantName"))}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={refineBySection === "plantName"}
            >
              <span>Plant Name</span>
              <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "plantName" ? "▼" : "▸"}</span>
            </button>
            {refineBySection === "plantName" && (
              <div className="px-4 pb-3 pt-0">
                <SearchableMultiSelect
                  options={plantNameOptions.map((name) => ({ id: name, label: name }))}
                  selectedIds={new Set(vaultFilters.filters.plantNames)}
                  onChange={(set) => vaultFilters.setPlantNames([...set])}
                  label="Plant Name"
                  hideLabel
                  dropdownZIndex={120}
                />
              </div>
            )}
          </div>
          {/* Plant in [Month] */}
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setRefineBySection((s) => (s === "plantMonth" ? null : "plantMonth"))}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={refineBySection === "plantMonth"}
            >
              <span>{vaultFilters.filters.plantMonth != null ? `Plant in ${MONTH_NAMES[vaultFilters.filters.plantMonth - 1]}` : "Plant in Month"}</span>
              <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "plantMonth" ? "▼" : "▸"}</span>
            </button>
            {refineBySection === "plantMonth" && (
              <div className="px-4 pb-3 pt-0 max-h-[260px] overflow-y-auto space-y-0.5">
                <button
                  type="button"
                  onClick={() => vaultFilters.setPlantMonth(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.plantMonth == null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                >
                  Any month
                </button>
                {MONTH_NAMES.map((monthName, i) => {
                  const monthNum = i + 1;
                  const selected = vaultFilters.filters.plantMonth === monthNum;
                  return (
                    <button
                      key={monthNum}
                      type="button"
                      onClick={() => vaultFilters.setPlantMonth(monthNum)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {monthName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Inventory (4 toggles) */}
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setRefineBySection((s) => (s === "inventory" ? null : "inventory"))}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={refineBySection === "inventory"}
            >
              <span>Inventory</span>
              <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "inventory" ? "▼" : "▸"}</span>
            </button>
            {refineBySection === "inventory" && (
              <div className="px-4 pb-3 pt-0 space-y-0.5">
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]">
                  <input type="checkbox" checked={vaultFilters.filters.invGrowing} onChange={() => vaultFilters.toggleInventory("growing")} className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500" aria-label="Currently growing" />
                  <span className="text-sm text-black/80">Currently growing</span>
                </label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]">
                  <input type="checkbox" checked={vaultFilters.filters.invHasPackets} onChange={() => vaultFilters.toggleInventory("hasPackets")} className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500" aria-label="Has packets in inventory" />
                  <span className="text-sm text-black/80">Has packets in inventory</span>
                </label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]">
                  <input type="checkbox" checked={vaultFilters.filters.invPrevGrown} onChange={() => vaultFilters.toggleInventory("prevGrown")} className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500" aria-label="Previously grown" />
                  <span className="text-sm text-black/80">Previously grown</span>
                </label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]">
                  <input type="checkbox" checked={vaultFilters.filters.invPrevOwned} onChange={() => vaultFilters.toggleInventory("prevOwned")} className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500" aria-label="Previously owned" />
                  <span className="text-sm text-black/80">Previously owned</span>
                </label>
              </div>
            )}
          </div>
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setRefineBySection((s) => (s === "sort" ? null : "sort"))}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={refineBySection === "sort"}
            >
              <span>Sort By</span>
              <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                {refineBySection === "sort" ? "▼" : "▸"}
              </span>
            </button>
            {refineBySection === "sort" && (
              <div className="px-4 pb-3 pt-0 space-y-0.5">
                {sectionOptions.map(({ sortBy: sb, sortDirection: sd, label }) => {
                  const selected = sortBy === sb && sortDirection === sd;
                  return (
                    <button
                      key={`${sb}-${sd}`}
                      type="button"
                      onClick={() => {
                        setSortBy(sb);
                        setSortDirection(sd);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* More Filters */}
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setMoreFiltersOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={moreFiltersOpen}
            >
              <span>More Filters</span>
              <span className="text-black/50 shrink-0 ml-2" aria-hidden>{moreFiltersOpen ? "▼" : "▸"}</span>
            </button>
            {moreFiltersOpen && (
              <div>
                {/* Variety */}
                {refineChips.variety.length > 0 && (
                  <div className="border-t border-black/5">
                    <button type="button" onClick={() => setRefineBySection((s) => (s === "variety" ? null : "variety"))} className="w-full flex items-center justify-between px-6 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "variety"}>
                      <span>Variety</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "variety" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "variety" && (
                      <div className="px-6 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                        <button type="button" onClick={() => vaultFilters.setVariety(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.variety === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                        {refineChips.variety.map(({ value, count }) => (
                          <button key={value} type="button" onClick={() => vaultFilters.setVariety(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] truncate ${vaultFilters.filters.variety === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Sun */}
                {refineChips.sun.length > 0 && (
                  <div className="border-t border-black/5">
                    <button type="button" onClick={() => setRefineBySection((s) => (s === "sun" ? null : "sun"))} className="w-full flex items-center justify-between px-6 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "sun"}>
                      <span>Sun</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "sun" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "sun" && (
                      <div className="px-6 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                        <button type="button" onClick={() => vaultFilters.setSun(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.sun === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                        {refineChips.sun.map(({ value, count }) => (
                          <button key={value} type="button" onClick={() => vaultFilters.setSun(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.sun === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Spacing */}
                {refineChips.spacing.length > 0 && (
                  <div className="border-t border-black/5">
                    <button type="button" onClick={() => setRefineBySection((s) => (s === "spacing" ? null : "spacing"))} className="w-full flex items-center justify-between px-6 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "spacing"}>
                      <span>Spacing</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "spacing" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "spacing" && (
                      <div className="px-6 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                        <button type="button" onClick={() => vaultFilters.setSpacing(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.spacing === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                        {refineChips.spacing.map(({ value, count }) => (
                          <button key={value} type="button" onClick={() => vaultFilters.setSpacing(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] truncate ${vaultFilters.filters.spacing === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Germination */}
                {refineChips.germination.length > 0 && (
                  <div className="border-t border-black/5">
                    <button type="button" onClick={() => setRefineBySection((s) => (s === "germination" ? null : "germination"))} className="w-full flex items-center justify-between px-6 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "germination"}>
                      <span>Germination</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "germination" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "germination" && (
                      <div className="px-6 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                        <button type="button" onClick={() => vaultFilters.setGermination(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.germination === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                        {refineChips.germination.map(({ value, count }) => (
                          <button key={value} type="button" onClick={() => vaultFilters.setGermination(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] truncate ${vaultFilters.filters.germination === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Maturity */}
                {refineChips.maturity.length > 0 && (
                  <div className="border-t border-black/5">
                    <button type="button" onClick={() => setRefineBySection((s) => (s === "maturity" ? null : "maturity"))} className="w-full flex items-center justify-between px-6 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "maturity"}>
                      <span>Maturity</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "maturity" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "maturity" && (
                      <div className="px-6 pb-3 pt-0 space-y-0.5">
                        <button type="button" onClick={() => vaultFilters.setMaturity(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.maturity === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                        {refineChips.maturity.map(({ value, count }) => (
                          <button key={value} type="button" onClick={() => vaultFilters.setMaturity(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.maturity === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value === "<60" ? "<60 days" : value === "60-90" ? "60–90 days" : "90+ days"} ({count})</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Packet Count */}
                {refineChips.packetCount.length > 0 && (
                  <div className="border-t border-black/5">
                    <button type="button" onClick={() => setRefineBySection((s) => (s === "packetCount" ? null : "packetCount"))} className="w-full flex items-center justify-between px-6 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "packetCount"}>
                      <span>Packet Count</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "packetCount" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "packetCount" && (
                      <div className="px-6 pb-3 pt-0 space-y-0.5">
                        <button type="button" onClick={() => vaultFilters.setPacketCount(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.packetCount === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                        {refineChips.packetCount.map(({ value, count }) => (
                          <button key={value} type="button" onClick={() => vaultFilters.setPacketCount(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.packetCount === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value === "2+" ? "2+ packets" : value === "1" ? "1 packet" : "0 packets"} ({count})</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Method */}
                {refineChips.method.length > 0 && (
                  <div className="border-t border-black/5">
                    <button type="button" onClick={() => setRefineBySection((s) => (s === "method" ? null : "method"))} className="w-full flex items-center justify-between px-6 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "method"}>
                      <span>Method</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "method" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "method" && (
                      <div className="px-6 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                        <button type="button" onClick={() => vaultFilters.setMethod(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.method === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                        {refineChips.method.map(({ value, count }) => (
                          <button key={value} type="button" onClick={() => vaultFilters.setMethod(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.method === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value === "indoors" ? "Start Indoors" : "Plant Outdoors"} ({count})</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Vendor */}
                {refineChips.vendor.length > 0 && (
                  <div className="border-t border-black/5">
                    <button type="button" onClick={() => setRefineBySection((s) => (s === "vendor" ? null : "vendor"))} className="w-full flex items-center justify-between px-6 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "vendor"}>
                      <span>Vendor</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "vendor" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "vendor" && (
                      <div className="px-6 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                        <button type="button" onClick={() => vaultFilters.setVendor(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${vaultFilters.filters.vendor === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                        {refineChips.vendor.map(({ value, count }) => (
                          <button key={value} type="button" onClick={() => vaultFilters.setVendor(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] truncate ${vaultFilters.filters.vendor === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Tags */}
                {availableTags.filter((t) => !isSeedTypeTag(t)).length > 0 && (
                  <div className="border-t border-black/5">
                    <button type="button" onClick={() => setRefineBySection((s) => (s === "tags" ? null : "tags"))} className="w-full flex items-center justify-between px-6 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "tags"}>
                      <span>Tags</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "tags" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "tags" && (
                      <div className="px-6 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                        {availableTags.filter((t) => !isSeedTypeTag(t)).map((tag) => {
                          const checked = vaultFilters.filters.tags.includes(tag);
                          return (
                            <label key={tag} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]">
                              <input type="checkbox" checked={checked} onChange={() => vaultFilters.toggleTagFilter(tag)} className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500" aria-label={`Filter by ${tag}`} />
                              <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${getTagStyle(tag)}`}>{tag}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <footer className="flex-shrink-0 border-t border-black/10 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            {!vaultFilters.hasDefault && (
              <button
                type="button"
                onClick={() => vaultFilters.saveAsDefault({ sortBy, sortDirection })}
                className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                aria-label="Save current filters and sort as default"
              >
                Save Default
              </button>
            )}
            {vaultFilters.hasDefault && (
              <button
                type="button"
                onClick={vaultFilters.clearDefault}
                className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-black/60 hover:bg-black/5"
                aria-label="Reset saved default filters"
              >
                Reset Default
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-xl bg-emerald text-white font-medium text-sm"
          >
            Show Results ({filteredVarietyIds.length})
          </button>
        </footer>
      </div>
    </>
  );
}
