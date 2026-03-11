"use client";

import type { StatusFilter, VaultSortBy } from "@/types/vault";
import type { UseFilterStateReturn } from "@/hooks/useFilterState";
import { getTagStyle } from "@/components/TagBadges";
import { isSeedTypeTag } from "@/constants/seedTypes";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export type GridRefineSection =
  | "sort"
  | "vault"
  | "tags"
  | "seedType"
  | "sowingMonth"
  | "vendor"
  | "sun"
  | "spacing"
  | "germination"
  | "maturity"
  | "packetCount"
  | "packetVendor"
  | "packetSow"
  | null;

export type RefineChips = {
  vendor: { value: string; count: number }[];
  sun: { value: string; count: number }[];
  spacing: { value: string; count: number }[];
  germination: { value: string; count: number }[];
  maturity: { value: string; count: number }[];
  packetCount: { value: string; count: number }[];
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
  vaultStatusChips: { value: StatusFilter; label: string; count: number }[];
  seedTypeChips: { value: string; count: number }[];
  availableTags: string[];
  sowingMonthChips: { month: number; monthName: string; count: number }[];
  sowParam: string | null;
  refineChips: RefineChips;
  filteredVarietyIds: string[];
  router: AppRouterInstance;
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
  vaultStatusChips,
  seedTypeChips,
  availableTags,
  sowingMonthChips,
  sowParam,
  refineChips,
  filteredVarietyIds,
  router,
}: VaultGridRefineModalProps) {
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

  const statusOptions =
    vaultStatusChips.length > 0
      ? vaultStatusChips
      : [
          { value: "" as StatusFilter, label: "All", count: 0 },
          { value: "vault" as StatusFilter, label: "In Storage", count: 0 },
          { value: "active" as StatusFilter, label: "Active", count: 0 },
          { value: "low_inventory" as StatusFilter, label: "Low Inventory", count: 0 },
          { value: "archived" as StatusFilter, label: "Archived", count: 0 },
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
                aria-label="Clear all filters"
              >
                Clear filters
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-black/60 hover:bg-black/5 hover:text-black"
              aria-label="Close"
            >
              <span className="text-xl leading-none" aria-hidden>×</span>
            </button>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setRefineBySection((s) => (s === "sort" ? null : "sort"))}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={refineBySection === "sort"}
            >
              <span>Sort</span>
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
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setRefineBySection((s) => (s === "vault" ? null : "vault"))}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={refineBySection === "vault"}
            >
              <span>Vault Status</span>
              <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                {refineBySection === "vault" ? "▼" : "▸"}
              </span>
            </button>
            {refineBySection === "vault" && (
              <div className="px-4 pb-3 pt-0 space-y-0.5">
                {statusOptions.map(({ value, label, count }) => {
                  const selected = vaultFilters.filters.status === value;
                  return (
                    <button
                      key={value || "all"}
                      type="button"
                      onClick={() => vaultFilters.setStatus(value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {availableTags.filter((t) => !isSeedTypeTag(t)).length > 0 && (
            <div className="border-b border-black/5">
              <button
                type="button"
                onClick={() => setRefineBySection((s) => (s === "tags" ? null : "tags"))}
                className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                aria-expanded={refineBySection === "tags"}
              >
                <span>Tags</span>
                <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                  {refineBySection === "tags" ? "▼" : "▸"}
                </span>
              </button>
              {refineBySection === "tags" && (
                <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                  {availableTags.filter((t) => !isSeedTypeTag(t)).map((tag) => {
                    const checked = vaultFilters.filters.tags.includes(tag);
                    return (
                      <label
                        key={tag}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => vaultFilters.toggleTagFilter(tag)}
                          className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                          aria-label={`Filter by ${tag}`}
                        />
                        <span
                          className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${getTagStyle(tag)}`}
                        >
                          {tag}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {seedTypeChips.length > 0 && (
            <div className="border-b border-black/5">
              <button
                type="button"
                onClick={() => setRefineBySection((s) => (s === "seedType" ? null : "seedType"))}
                className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                aria-expanded={refineBySection === "seedType"}
              >
                <span>Seed Type</span>
                <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                  {refineBySection === "seedType" ? "▼" : "▸"}
                </span>
              </button>
              {refineBySection === "seedType" && (
                <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                  {seedTypeChips.map(({ value, count }) => {
                    const checked = vaultFilters.filters.seedTypes.includes(value);
                    return (
                      <label
                        key={value}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => vaultFilters.toggleSeedTypeFilter(value)}
                          className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                          aria-label={`Filter by ${value}`}
                        />
                        <span className="text-sm text-black/80">
                          {value} ({count})
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setRefineBySection((s) => (s === "sowingMonth" ? null : "sowingMonth"))}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={refineBySection === "sowingMonth"}
            >
              <span>Sowing Month</span>
              <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                {refineBySection === "sowingMonth" ? "▼" : "▸"}
              </span>
            </button>
            {refineBySection === "sowingMonth" && (
              <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    router.replace("/vault", { scroll: false });
                    onClose();
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${!sowParam ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const sow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                    router.push(`/vault?sow=${sow}`);
                    onClose();
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${
                    sowParam &&
                    /^\d{4}-\d{2}$/.test(sowParam) &&
                    sowParam ===
                      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
                      ? "bg-emerald/10 text-emerald-800 font-medium"
                      : "text-black/80 hover:bg-black/5"
                  }`}
                >
                  Plant Now
                </button>
                {sowingMonthChips.map(({ month, monthName, count }) => {
                  const year = new Date().getFullYear();
                  const sowVal = `${year}-${String(month).padStart(2, "0")}`;
                  const selected = sowParam === sowVal;
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => {
                        router.push(`/vault?sow=${sowVal}`);
                        onClose();
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {monthName} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {refineChips.vendor.length > 0 && (
            <div className="border-b border-black/5">
              <button
                type="button"
                onClick={() => setRefineBySection((s) => (s === "vendor" ? null : "vendor"))}
                className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                aria-expanded={refineBySection === "vendor"}
              >
                <span>Vendor</span>
                <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                  {refineBySection === "vendor" ? "▼" : "▸"}
                </span>
              </button>
              {refineBySection === "vendor" && (
                <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                  <button
                    type="button"
                    onClick={() => vaultFilters.setVendor(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.vendor === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                  >
                    All
                  </button>
                  {refineChips.vendor.map(({ value, count }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => vaultFilters.setVendor(value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${vaultFilters.filters.vendor === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {value} ({count})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {refineChips.sun.length > 0 && (
            <div className="border-b border-black/5">
              <button
                type="button"
                onClick={() => setRefineBySection((s) => (s === "sun" ? null : "sun"))}
                className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                aria-expanded={refineBySection === "sun"}
              >
                <span>Sun</span>
                <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                  {refineBySection === "sun" ? "▼" : "▸"}
                </span>
              </button>
              {refineBySection === "sun" && (
                <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                  <button
                    type="button"
                    onClick={() => vaultFilters.setSun(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.sun === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                  >
                    All
                  </button>
                  {refineChips.sun.map(({ value, count }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => vaultFilters.setSun(value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.sun === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {value} ({count})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {refineChips.spacing.length > 0 && (
            <div className="border-b border-black/5">
              <button
                type="button"
                onClick={() => setRefineBySection((s) => (s === "spacing" ? null : "spacing"))}
                className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                aria-expanded={refineBySection === "spacing"}
              >
                <span>Spacing</span>
                <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                  {refineBySection === "spacing" ? "▼" : "▸"}
                </span>
              </button>
              {refineBySection === "spacing" && (
                <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                  <button
                    type="button"
                    onClick={() => vaultFilters.setSpacing(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.spacing === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                  >
                    All
                  </button>
                  {refineChips.spacing.map(({ value, count }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => vaultFilters.setSpacing(value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${vaultFilters.filters.spacing === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {value} ({count})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {refineChips.germination.length > 0 && (
            <div className="border-b border-black/5">
              <button
                type="button"
                onClick={() => setRefineBySection((s) => (s === "germination" ? null : "germination"))}
                className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                aria-expanded={refineBySection === "germination"}
              >
                <span>Germination</span>
                <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                  {refineBySection === "germination" ? "▼" : "▸"}
                </span>
              </button>
              {refineBySection === "germination" && (
                <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                  <button
                    type="button"
                    onClick={() => vaultFilters.setGermination(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.germination === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                  >
                    All
                  </button>
                  {refineChips.germination.map(({ value, count }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => vaultFilters.setGermination(value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${vaultFilters.filters.germination === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {value} ({count})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {refineChips.maturity.length > 0 && (
            <div className="border-b border-black/5">
              <button
                type="button"
                onClick={() => setRefineBySection((s) => (s === "maturity" ? null : "maturity"))}
                className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                aria-expanded={refineBySection === "maturity"}
              >
                <span>Maturity</span>
                <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                  {refineBySection === "maturity" ? "▼" : "▸"}
                </span>
              </button>
              {refineBySection === "maturity" && (
                <div className="px-4 pb-3 pt-0 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => vaultFilters.setMaturity(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.maturity === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                  >
                    All
                  </button>
                  {refineChips.maturity.map(({ value, count }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => vaultFilters.setMaturity(value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.maturity === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {value === "<60" ? "<60 days" : value === "60-90" ? "60–90 days" : "90+ days"} ({count})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {refineChips.packetCount.length > 0 && (
            <div className="border-b border-black/5">
              <button
                type="button"
                onClick={() => setRefineBySection((s) => (s === "packetCount" ? null : "packetCount"))}
                className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                aria-expanded={refineBySection === "packetCount"}
              >
                <span>Packet Count</span>
                <span className="text-black/50 shrink-0 ml-2" aria-hidden>
                  {refineBySection === "packetCount" ? "▼" : "▸"}
                </span>
              </button>
              {refineBySection === "packetCount" && (
                <div className="px-4 pb-3 pt-0 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => vaultFilters.setPacketCount(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.packetCount === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                  >
                    All
                  </button>
                  {refineChips.packetCount.map(({ value, count }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => vaultFilters.setPacketCount(value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.packetCount === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {value === "2+" ? "2+ packets" : value === "1" ? "1 packet" : "0 packets"} ({count})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
