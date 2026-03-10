"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  loadFilterDefault,
  saveFilterDefault,
  clearFilterDefault,
  hasFilterDefault,
  FILTER_DEFAULT_KEYS,
} from "@/lib/filterDefaults";
import { ICON_MAP } from "@/lib/styleDictionary";
import { getTagStyle } from "@/components/TagBadges";
import { isSeedTypeTag } from "@/constants/seedTypes";
import type { PacketStatusFilter } from "@/types/vault";
import type { UseFilterStateReturn } from "@/hooks/useFilterState";

const PacketVaultLazy = dynamic(
  () => import("../PacketVaultLazy").then((m) => ({ default: m.PacketVaultLazy })),
  { ssr: false, loading: () => <div className="min-h-[200px] flex items-center justify-center text-neutral-500">Loading packets…</div> }
);

type PacketFilterDefault = { status: string; vendor: string | null; sowMonth: string | null; sortBy: string; sortDirection: string };

export type VaultPacketWingContextValue = {
  viewMode: "grid" | "list" | "shed";
  refetchTrigger: number;
  refetch: () => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  packetSearchQuery: string;
  setPacketSearchQuery: (v: string) => void;
  packetStatusFilter: PacketStatusFilter;
  setPacketStatusFilter: (v: PacketStatusFilter) => void;
  packetVendorFilter: string | null;
  setPacketVendorFilter: (v: string | null) => void;
  packetSortBy: "date" | "variety" | "vendor" | "qty" | "rating";
  setPacketSortBy: (v: "date" | "variety" | "vendor" | "qty" | "rating") => void;
  packetSortDirection: "asc" | "desc";
  setPacketSortDirection: (v: "asc" | "desc") => void;
  packetSowMonth: string | null;
  setPacketSowMonth: (v: string | null) => void;
  packetHasDefault: boolean;
  setPacketHasDefault: (v: boolean) => void;
  packetStatusChips: { value: PacketStatusFilter; label: string; count: number }[];
  setPacketStatusChips: React.Dispatch<React.SetStateAction<{ value: PacketStatusFilter; label: string; count: number }[]>>;
  packetVendorChips: { value: string; count: number }[];
  setPacketVendorChips: React.Dispatch<React.SetStateAction<{ value: string; count: number }[]>>;
  packetAvailableTags: string[];
  setPacketAvailableTags: React.Dispatch<React.SetStateAction<string[]>>;
  packetSeedTypeChips: { value: string; count: number }[];
  setPacketSeedTypeChips: React.Dispatch<React.SetStateAction<{ value: string; count: number }[]>>;
  packetRefineChips: { sun: { value: string; count: number }[]; spacing: { value: string; count: number }[]; germination: { value: string; count: number }[]; maturity: { value: string; count: number }[] };
  setPacketRefineChips: React.Dispatch<React.SetStateAction<{ sun: { value: string; count: number }[]; spacing: { value: string; count: number }[]; germination: { value: string; count: number }[]; maturity: { value: string; count: number }[] }>>;
  filteredPacketIds: string[];
  setFilteredPacketIds: React.Dispatch<React.SetStateAction<string[]>>;
  filteredPacketCount: number;
  setFilteredPacketCount: React.Dispatch<React.SetStateAction<number>>;
  refineByOpen: boolean;
  setRefineByOpen: (v: boolean) => void;
  refineBySection: "sort" | "vault" | "packetVendor" | "packetSow" | "tags" | "seedType" | "sun" | "spacing" | "germination" | "maturity" | null;
  setRefineBySection: React.Dispatch<React.SetStateAction<"sort" | "vault" | "packetVendor" | "packetSow" | "tags" | "seedType" | "sun" | "spacing" | "germination" | "maturity" | null>>;
  hasPacketActiveFilters: boolean;
  clearPacketFilters: () => void;
  batchSelectMode: boolean;
  setBatchSelectMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  selectedPacketIds: Set<string>;
  setSelectedPacketIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  vaultFilters: UseFilterStateReturn;
  onEmptyStateChange: (empty: boolean) => void;
  onSaveMessage: (message: string) => void;
  router: ReturnType<typeof useRouter>;
  onOpenScanner?: () => void;
  onAddFirst?: () => void;
};

const VaultPacketWingContext = createContext<VaultPacketWingContextValue | null>(null);

export function useVaultPacketWing(): VaultPacketWingContextValue {
  const ctx = useContext(VaultPacketWingContext);
  if (!ctx) throw new Error("useVaultPacketWing must be used within VaultPacketWingProvider");
  return ctx;
}

type VaultPacketWingProviderProps = {
  viewMode: "grid" | "list" | "shed";
  children: ReactNode;
  refetchTrigger: number;
  refetch: () => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  vaultFilters: UseFilterStateReturn;
  batchSelectMode: boolean;
  setBatchSelectMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  selectedPacketIds: Set<string>;
  setSelectedPacketIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onEmptyStateChange: (empty: boolean) => void;
  onSaveMessage: (message: string) => void;
  onOpenScanner?: () => void;
  onAddFirst?: () => void;
};

export function VaultPacketWingProvider({
  viewMode,
  children,
  refetchTrigger,
  refetch,
  scrollContainerRef,
  vaultFilters,
  batchSelectMode,
  setBatchSelectMode,
  selectedPacketIds,
  setSelectedPacketIds,
  onEmptyStateChange,
  onSaveMessage,
  onOpenScanner,
  onAddFirst,
}: VaultPacketWingProviderProps) {
  const router = useRouter();
  const [packetSearchQuery, setPacketSearchQuery] = useState("");
  const [packetStatusFilter, setPacketStatusFilter] = useState<PacketStatusFilter>("");
  const [packetVendorFilter, setPacketVendorFilter] = useState<string | null>(null);
  const [packetSortBy, setPacketSortBy] = useState<"date" | "variety" | "vendor" | "qty" | "rating">("date");
  const [packetSortDirection, setPacketSortDirection] = useState<"asc" | "desc">("desc");
  const [packetSowMonth, setPacketSowMonth] = useState<string | null>(null);
  const [packetHasDefault, setPacketHasDefault] = useState(() => hasFilterDefault(FILTER_DEFAULT_KEYS.vaultPackets));
  const [packetStatusChips, setPacketStatusChips] = useState<{ value: PacketStatusFilter; label: string; count: number }[]>([]);
  const [packetVendorChips, setPacketVendorChips] = useState<{ value: string; count: number }[]>([]);
  const [packetAvailableTags, setPacketAvailableTags] = useState<string[]>([]);
  const [packetSeedTypeChips, setPacketSeedTypeChips] = useState<{ value: string; count: number }[]>([]);
  const [packetRefineChips, setPacketRefineChips] = useState<{ sun: { value: string; count: number }[]; spacing: { value: string; count: number }[]; germination: { value: string; count: number }[]; maturity: { value: string; count: number }[] }>({ sun: [], spacing: [], germination: [], maturity: [] });
  const [filteredPacketIds, setFilteredPacketIds] = useState<string[]>([]);
  const [filteredPacketCount, setFilteredPacketCount] = useState(0);
  const [refineByOpen, setRefineByOpen] = useState(false);
  const [refineBySection, setRefineBySection] = useState<"sort" | "vault" | "packetVendor" | "packetSow" | "tags" | "seedType" | "sun" | "spacing" | "germination" | "maturity" | null>(null);
  const packetFiltersRestoredRef = useRef(false);

  const hasPacketActiveFilters =
    packetStatusFilter !== "" ||
    packetVendorFilter !== null ||
    (packetSowMonth != null && /^\d{4}-\d{2}$/.test(packetSowMonth)) ||
    vaultFilters.filters.tags.length > 0 ||
    vaultFilters.filters.seedTypes.length > 0 ||
    vaultFilters.filters.sun !== null ||
    vaultFilters.filters.spacing !== null ||
    vaultFilters.filters.germination !== null ||
    vaultFilters.filters.maturity !== null;

  const clearPacketFilters = useCallback(() => {
    setPacketStatusFilter("");
    setPacketVendorFilter(null);
    setPacketSowMonth(null);
    router.replace("/vault?tab=list", { scroll: false });
    vaultFilters.setTags([]);
    vaultFilters.setSeedTypes([]);
    vaultFilters.setSun(null);
    vaultFilters.setSpacing(null);
    vaultFilters.setGermination(null);
    vaultFilters.setMaturity(null);
    setRefineByOpen(false);
    setRefineBySection(null);
  }, [router, vaultFilters]);

  useEffect(() => {
    const loaded = loadFilterDefault<PacketFilterDefault>(FILTER_DEFAULT_KEYS.vaultPackets);
    if (!loaded || typeof loaded !== "object") return;
    const status = typeof loaded.status === "string" ? (loaded.status as PacketStatusFilter) : "";
    const vendor = typeof loaded.vendor === "string" ? loaded.vendor : loaded.vendor === null ? null : null;
    const sowMonth = typeof loaded.sowMonth === "string" && /^\d{4}-\d{2}$/.test(loaded.sowMonth) ? loaded.sowMonth : null;
    const sortBy = ["date", "variety", "vendor", "qty", "rating"].includes(loaded.sortBy) ? loaded.sortBy as "date" | "variety" | "vendor" | "qty" | "rating" : "date";
    const sortDirection = loaded.sortDirection === "asc" || loaded.sortDirection === "desc" ? loaded.sortDirection : "desc";
    setPacketStatusFilter(status);
    setPacketVendorFilter(vendor);
    setPacketSowMonth(sowMonth);
    setPacketSortBy(sortBy);
    setPacketSortDirection(sortDirection);
  }, []);

  useEffect(() => {
    if (packetFiltersRestoredRef.current || typeof window === "undefined") return;
    packetFiltersRestoredRef.current = true;
    try {
      const savedPacketSearch = sessionStorage.getItem("packet-vault-search");
      if (typeof savedPacketSearch === "string") setPacketSearchQuery(savedPacketSearch);
      const savedPacketStatus = sessionStorage.getItem("packet-vault-status");
      if (savedPacketStatus !== null && savedPacketStatus !== undefined) setPacketStatusFilter(savedPacketStatus as PacketStatusFilter);
      const savedPacketVendor = sessionStorage.getItem("packet-vault-vendor");
      setPacketVendorFilter(savedPacketVendor && savedPacketVendor !== "" ? savedPacketVendor : null);
      const savedPacketSow = sessionStorage.getItem("packet-vault-sow");
      setPacketSowMonth((savedPacketSow && /^\d{4}-\d{2}$/.test(savedPacketSow)) ? savedPacketSow : null);
      const savedPacketSort = sessionStorage.getItem("packet-vault-sort");
      if (savedPacketSort) {
        const parsed = JSON.parse(savedPacketSort) as { sortBy?: string; sortDirection?: string };
        if (["date", "variety", "vendor", "qty", "rating"].includes(parsed.sortBy ?? "")) setPacketSortBy(parsed.sortBy as "date" | "variety" | "vendor" | "qty" | "rating");
        if (parsed.sortDirection === "asc" || parsed.sortDirection === "desc") setPacketSortDirection(parsed.sortDirection);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("packet-vault-search", packetSearchQuery);
      sessionStorage.setItem("packet-vault-status", packetStatusFilter);
      sessionStorage.setItem("packet-vault-vendor", packetVendorFilter ?? "");
      sessionStorage.setItem("packet-vault-sow", packetSowMonth ?? "");
      sessionStorage.setItem("packet-vault-sort", JSON.stringify({ sortBy: packetSortBy, sortDirection: packetSortDirection }));
    } catch {
      /* ignore */
    }
  }, [packetSearchQuery, packetStatusFilter, packetVendorFilter, packetSowMonth, packetSortBy, packetSortDirection]);

  const value: VaultPacketWingContextValue = {
    viewMode,
    refetchTrigger,
    refetch,
    scrollContainerRef,
    packetSearchQuery,
    setPacketSearchQuery,
    packetStatusFilter,
    setPacketStatusFilter,
    packetVendorFilter,
    setPacketVendorFilter,
    packetSortBy,
    setPacketSortBy,
    packetSortDirection,
    setPacketSortDirection,
    packetSowMonth,
    setPacketSowMonth,
    packetHasDefault,
    setPacketHasDefault,
    packetStatusChips,
    setPacketStatusChips,
    packetVendorChips,
    setPacketVendorChips,
    packetAvailableTags,
    setPacketAvailableTags,
    packetSeedTypeChips,
    setPacketSeedTypeChips,
    packetRefineChips,
    setPacketRefineChips,
    filteredPacketIds,
    setFilteredPacketIds,
    filteredPacketCount,
    setFilteredPacketCount,
    refineByOpen,
    setRefineByOpen,
    refineBySection,
    setRefineBySection,
    hasPacketActiveFilters,
    clearPacketFilters,
    batchSelectMode,
    setBatchSelectMode,
    selectedPacketIds,
    setSelectedPacketIds,
    vaultFilters,
    onEmptyStateChange,
    onSaveMessage,
    router,
    onOpenScanner: onOpenScanner ?? (() => {}),
    onAddFirst: onAddFirst ?? (() => {}),
  };

  return (
    <VaultPacketWingContext.Provider value={value}>
      {children}
    </VaultPacketWingContext.Provider>
  );
}

export function VaultPacketWingToolbar() {
  const ctx = useContext(VaultPacketWingContext);
  if (!ctx || ctx.viewMode !== "list") return null;
  const {
    packetSearchQuery,
    setPacketSearchQuery,
    hasPacketActiveFilters,
    clearPacketFilters,
    setRefineByOpen,
    batchSelectMode,
    setBatchSelectMode,
    selectedPacketIds,
    setSelectedPacketIds,
    filteredPacketIds,
    setFilteredPacketIds,
    filteredPacketCount,
  } = ctx;
  return (
    <>
      <div className="flex gap-2 mb-2">
        <div className="flex-1 relative">
          <ICON_MAP.Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-black/40 pointer-events-none" aria-hidden />
          <input
            type="search"
            value={packetSearchQuery}
            onChange={(e) => setPacketSearchQuery(e.target.value)}
            placeholder="Search packets…"
            className="w-full rounded-xl bg-neutral-100 border-0 pl-10 pr-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:ring-inset min-h-[44px]"
            aria-label="Search packets"
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 gap-y-2 relative z-40">
          <button
            type="button"
            onClick={() => setRefineByOpen(true)}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 flex items-center gap-2 shrink-0"
            aria-label="Filter by status, vendor, sow"
          >
            <ICON_MAP.Filter className="w-5 h-5 shrink-0" />
            Filter
            {hasPacketActiveFilters && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald text-white text-xs font-semibold">
                {[
                  packetSearchQuery.trim() ? 1 : 0,
                  ctx.packetStatusFilter !== "" ? 1 : 0,
                  ctx.packetVendorFilter !== null ? 1 : 0,
                  ctx.packetSowMonth != null && /^\d{4}-\d{2}$/.test(ctx.packetSowMonth) ? 1 : 0,
                  ctx.vaultFilters.filters.tags.length,
                  ctx.vaultFilters.filters.seedTypes.length,
                  ctx.vaultFilters.filters.sun !== null ? 1 : 0,
                  ctx.vaultFilters.filters.spacing !== null ? 1 : 0,
                  ctx.vaultFilters.filters.germination !== null ? 1 : 0,
                  ctx.vaultFilters.filters.maturity !== null ? 1 : 0,
                ].reduce((a, b) => a + b, 0)}
              </span>
            )}
          </button>
          {hasPacketActiveFilters && (
            <button
              type="button"
              onClick={clearPacketFilters}
              className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald/10 shrink-0"
              aria-label="Clear all filters"
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (batchSelectMode) {
                setBatchSelectMode(false);
                setSelectedPacketIds(new Set());
              } else {
                setBatchSelectMode(true);
              }
            }}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 shrink-0"
          >
            {batchSelectMode ? "Cancel" : "Select"}
          </button>
          {batchSelectMode && filteredPacketIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedPacketIds(new Set(filteredPacketIds))}
              className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5"
              id="packet-select-all"
            >
              Select All
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function VaultPacketWingContent() {
  const ctx = useContext(VaultPacketWingContext);
  if (!ctx || ctx.viewMode !== "list") return null;
  const {
    refetchTrigger,
    scrollContainerRef,
    packetSearchQuery,
    packetStatusFilter,
    packetVendorFilter,
    packetSortBy,
    packetSortDirection,
    packetSowMonth,
    batchSelectMode,
    selectedPacketIds,
    setSelectedPacketIds,
    setFilteredPacketIds,
    setFilteredPacketCount,
    onEmptyStateChange,
    vaultFilters,
    setPacketStatusChips,
    setPacketVendorChips,
    setPacketAvailableTags,
    setPacketSeedTypeChips,
    setPacketRefineChips,
    onOpenScanner,
    onAddFirst,
  } = ctx;

  const togglePacketSelection = useCallback((packetId: string) => {
    setSelectedPacketIds((prev) => {
      const next = new Set(prev);
      if (next.has(packetId)) next.delete(packetId);
      else next.add(packetId);
      return next;
    });
  }, [setSelectedPacketIds]);

  const handleLongPressPacket = useCallback((packetId: string) => {
    ctx.setBatchSelectMode(true);
    setSelectedPacketIds((prev) => new Set([...prev, packetId]));
  }, [ctx, setSelectedPacketIds]);

  return (
    <div className="relative z-10 pt-2">
      {packetSowMonth && /^\d{4}-\d{2}$/.test(packetSowMonth) && (
        <div className="mb-3 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-emerald-800">
            Plant this month ({(() => {
              const [, m] = packetSowMonth.split("-").map(Number);
              return new Date(2000, (m ?? 1) - 1).toLocaleString("default", { month: "long" });
            })()})
          </span>
          <button type="button" onClick={() => ctx.setPacketSowMonth(null)} className="text-sm font-medium text-emerald-700 hover:text-emerald-800 underline">Show all</button>
        </div>
      )}
      <PacketVaultLazy
        refetchTrigger={refetchTrigger}
        scrollContainerRef={scrollContainerRef}
        searchQuery={packetSearchQuery}
        statusFilter={packetStatusFilter}
        vendorFilter={packetVendorFilter}
        sortBy={packetSortBy}
        sortDirection={packetSortDirection}
        sowMonth={packetSowMonth}
        batchSelectMode={batchSelectMode}
        selectedPacketIds={selectedPacketIds}
        onTogglePacketSelection={togglePacketSelection}
        onLongPressPacket={handleLongPressPacket}
        onFilteredPacketIdsChange={setFilteredPacketIds}
        onFilteredCountChange={setFilteredPacketCount}
        onEmptyStateChange={onEmptyStateChange}
        onOpenScanner={onOpenScanner}
        onAddFirst={onAddFirst}
        onPacketStatusChipsLoaded={setPacketStatusChips}
        onPacketVendorChipsLoaded={setPacketVendorChips}
        tagFilters={vaultFilters.filters.tags}
        seedTypeFilters={vaultFilters.filters.seedTypes}
        sunFilter={vaultFilters.filters.sun}
        spacingFilter={vaultFilters.filters.spacing}
        germinationFilter={vaultFilters.filters.germination}
        maturityFilter={vaultFilters.filters.maturity}
        onPacketTagsLoaded={setPacketAvailableTags}
        onPacketSeedTypeChipsLoaded={setPacketSeedTypeChips}
        onPacketRefineChipsLoaded={setPacketRefineChips}
      />
    </div>
  );
}

export function VaultPacketWingRefineModal() {
  return null;
}
