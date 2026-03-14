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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";
import { cascadeForDeletedPackets } from "@/lib/cascadeOnPacketDelete";
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
import { LoadingState } from "@/components/LoadingState";
import type { UseFilterStateReturn } from "@/hooks/useFilterState";

const PacketVaultLazy = dynamic(
  () => import("../PacketVaultLazy").then((m) => ({ default: m.PacketVaultLazy })),
  { ssr: false, loading: () => <LoadingState message="Loading packets…" className="min-h-[200px]" /> }
);
const EditPacketModal = dynamic(
  () => import("@/components/EditPacketModal").then((m) => ({ default: m.EditPacketModal })),
  { ssr: false }
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
  vaultFilters: UseFilterStateReturn<"vault">;
  onEmptyStateChange: (empty: boolean) => void;
  onSaveMessage: (message: string) => void;
  router: ReturnType<typeof useRouter>;
  onOpenScanner?: () => void;
  onAddFirst?: () => void;
  packetModalOpen: boolean;
  openSelectionActions: () => void;
  closeAllPacketModals: () => void;
  selectionActionsOpen: boolean;
  setSelectionActionsOpen: (v: boolean) => void;
  batchPacketDeleteConfirmOpen: boolean;
  setBatchPacketDeleteConfirmOpen: (v: boolean) => void;
  editPacketId: string | null;
  setEditPacketId: (v: string | null) => void;
  editPacketModalOpen: boolean;
  setEditPacketModalOpen: (v: boolean) => void;
  batchPacketDeleting: boolean;
  handleBatchDeletePackets: (deleteGrowInstances: boolean) => Promise<void>;
};

const VaultPacketWingContext = createContext<VaultPacketWingContextValue | null>(null);

export function useVaultPacketWing(): VaultPacketWingContextValue {
  const ctx = useContext(VaultPacketWingContext);
  if (!ctx) throw new Error("useVaultPacketWing must be used within VaultPacketWingProvider");
  return ctx;
}

export function useVaultPacketWingOptional(): VaultPacketWingContextValue | null {
  return useContext(VaultPacketWingContext);
}

/** Syncs packet modal open and selection state to parent for FAB and useModalBackClose. Render inside VaultPacketWingProvider. */
export function VaultPacketWingBridge({
  onPacketModalOpenChange,
  onPacketSelectionStateChange,
  packetActionsRef,
  sharedSearchQuery,
  onSyncSearchToGrid,
}: {
  onPacketModalOpenChange: (open: boolean) => void;
  onPacketSelectionStateChange: (state: { batchSelectMode: boolean; selectedPacketIds: Set<string> }) => void;
  packetActionsRef: React.MutableRefObject<{
    openSelectionActions: () => void;
    closeAllPacketModals: () => void;
  } | null>;
  sharedSearchQuery?: string;
  onSyncSearchToGrid?: (query: string) => void;
}) {
  const wing = useVaultPacketWingOptional();
  useEffect(() => {
    onPacketModalOpenChange(wing?.packetModalOpen ?? false);
  }, [wing?.packetModalOpen, onPacketModalOpenChange]);
  useEffect(() => {
    if (!wing) return;
    onPacketSelectionStateChange({
      batchSelectMode: wing.batchSelectMode,
      selectedPacketIds: wing.selectedPacketIds,
    });
  }, [wing?.batchSelectMode, wing?.selectedPacketIds, onPacketSelectionStateChange]);
  useEffect(() => {
    if (wing) {
      packetActionsRef.current = {
        openSelectionActions: wing.openSelectionActions,
        closeAllPacketModals: wing.closeAllPacketModals,
      };
    } else {
      packetActionsRef.current = null;
    }
    return () => {
      packetActionsRef.current = null;
    };
  }, [wing, packetActionsRef]);
  const prevViewModeRef = useRef<"grid" | "list" | "shed">(wing?.viewMode ?? "grid");
  useEffect(() => {
    if (!wing) return;
    const prev = prevViewModeRef.current;
    const curr = wing.viewMode;
    if (prev !== "list" && curr === "list" && sharedSearchQuery !== undefined) {
      wing.setPacketSearchQuery(sharedSearchQuery);
    }
    if (prev === "list" && curr !== "list" && onSyncSearchToGrid) {
      onSyncSearchToGrid(wing.packetSearchQuery);
    }
    prevViewModeRef.current = curr;
  }, [wing?.viewMode, wing?.packetSearchQuery, wing?.setPacketSearchQuery, sharedSearchQuery, onSyncSearchToGrid]);
  return null;
}

type VaultPacketWingProviderProps = {
  viewMode: "grid" | "list" | "shed";
  children: ReactNode;
  vaultFilters: UseFilterStateReturn<"vault">;
  onEmptyStateChange: (empty: boolean) => void;
  onSaveMessage: (message: string) => void;
  onOpenScanner?: () => void;
  onAddFirst?: () => void;
  sharedSearchQuery?: string;
  onSyncSearchToGrid?: (query: string) => void;
};

export function VaultPacketWingProvider({
  viewMode,
  children,
  vaultFilters,
  onEmptyStateChange,
  onSaveMessage,
  onOpenScanner,
  onAddFirst,
  sharedSearchQuery,
  onSyncSearchToGrid,
}: VaultPacketWingProviderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { refetchTrigger, refetch, scrollContainerRef } = useVault();
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
  const [batchSelectMode, setBatchSelectMode] = useState(false);
  const [selectedPacketIds, setSelectedPacketIds] = useState<Set<string>>(new Set());
  const [selectionActionsOpen, setSelectionActionsOpen] = useState(false);
  const [batchPacketDeleteConfirmOpen, setBatchPacketDeleteConfirmOpen] = useState(false);
  const [editPacketId, setEditPacketId] = useState<string | null>(null);
  const [editPacketModalOpen, setEditPacketModalOpen] = useState(false);
  const [batchPacketDeleting, setBatchPacketDeleting] = useState(false);
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

  const handleBatchDeletePackets = useCallback(
    async (deleteGrowInstances: boolean) => {
      if (selectedPacketIds.size === 0) return;
      const uid = user?.id;
      if (!uid) {
        onSaveMessage("You must be signed in to delete.");
        return;
      }
      setBatchPacketDeleting(true);
      try {
        await cascadeForDeletedPackets(supabase, Array.from(selectedPacketIds), uid, { deleteGrowInstances });
        const count = selectedPacketIds.size;
        setSelectedPacketIds(new Set());
        setBatchSelectMode(false);
        setBatchPacketDeleteConfirmOpen(false);
        refetch();
        onSaveMessage(`${count} packet${count === 1 ? "" : "s"} removed.`);
      } catch (err) {
        onSaveMessage(err instanceof Error ? err.message : "Could not delete packets.");
      } finally {
        setBatchPacketDeleting(false);
      }
    },
    [user?.id, selectedPacketIds, refetch, onSaveMessage]
  );

  const packetModalOpen =
    refineByOpen || selectionActionsOpen || batchPacketDeleteConfirmOpen || editPacketModalOpen;

  const openSelectionActions = useCallback(() => {
    setSelectionActionsOpen(true);
  }, []);

  const closeAllPacketModals = useCallback(() => {
    setRefineByOpen(false);
    setSelectionActionsOpen(false);
    setBatchPacketDeleteConfirmOpen(false);
    setEditPacketModalOpen(false);
    setEditPacketId(null);
  }, []);

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
    packetModalOpen,
    openSelectionActions,
    closeAllPacketModals,
    selectionActionsOpen,
    setSelectionActionsOpen,
    batchPacketDeleteConfirmOpen,
    setBatchPacketDeleteConfirmOpen,
    editPacketId,
    setEditPacketId,
    editPacketModalOpen,
    setEditPacketModalOpen,
    batchPacketDeleting,
    handleBatchDeletePackets,
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
            {(hasPacketActiveFilters ?? false) && (
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
          {(hasPacketActiveFilters ?? false) && (
            <button
              type="button"
              onClick={() => clearPacketFilters?.()}
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
  } = ctx ?? {};

  const togglePacketSelection = useCallback((packetId: string) => {
    if (!setSelectedPacketIds) return;
    setSelectedPacketIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(packetId)) next.delete(packetId);
      else next.add(packetId);
      return next;
    });
  }, [setSelectedPacketIds]);

  const handleLongPressPacket = useCallback((packetId: string) => {
    if (!ctx?.setBatchSelectMode || !setSelectedPacketIds) return;
    ctx.setBatchSelectMode(true);
    setSelectedPacketIds((prev: Set<string>) => new Set([...prev, packetId]));
  }, [ctx, setSelectedPacketIds]);

  if (!ctx || ctx.viewMode !== "list") return null;

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
        tagFilters={vaultFilters!.filters.tags}
        seedTypeFilters={vaultFilters!.filters.seedTypes}
        sunFilter={vaultFilters!.filters.sun}
        spacingFilter={vaultFilters!.filters.spacing}
        germinationFilter={vaultFilters!.filters.germination}
        maturityFilter={vaultFilters!.filters.maturity}
        onPacketTagsLoaded={setPacketAvailableTags}
        onPacketSeedTypeChipsLoaded={setPacketSeedTypeChips}
        onPacketRefineChipsLoaded={setPacketRefineChips}
        onClearFilters={ctx.clearPacketFilters}
      />
    </div>
  );
}

export function VaultPacketWingRefineModal() {
  const ctx = useContext(VaultPacketWingContext);
  const {
    setRefineByOpen,
    refineBySection,
    setRefineBySection,
    hasPacketActiveFilters,
    clearPacketFilters,
    packetSortBy,
    setPacketSortBy,
    packetSortDirection,
    setPacketSortDirection,
    packetStatusFilter,
    setPacketStatusFilter,
    packetStatusChips,
    packetVendorFilter,
    setPacketVendorFilter,
    packetVendorChips,
    packetSowMonth,
    setPacketSowMonth,
    packetAvailableTags,
    packetSeedTypeChips,
    vaultFilters,
    packetHasDefault,
    setPacketHasDefault,
    filteredPacketCount,
    router,
  } = ctx ?? {};

  const closeModal = useCallback(() => {
    if (!setRefineByOpen || !setRefineBySection) return;
    setRefineByOpen(false);
    setRefineBySection(null);
  }, [setRefineByOpen, setRefineBySection]);

  const statusOptions = (packetStatusChips?.length ?? 0) > 0
    ? (packetStatusChips ?? [])
    : [
        { value: "" as PacketStatusFilter, label: "All", count: 0 },
        { value: "vault" as PacketStatusFilter, label: "In Storage", count: 0 },
        { value: "active" as PacketStatusFilter, label: "Active", count: 0 },
        { value: "low_inventory" as PacketStatusFilter, label: "Low Inventory", count: 0 },
        { value: "archived" as PacketStatusFilter, label: "Archived", count: 0 },
      ];

  const saveAsDefault = useCallback(() => {
    if (!setPacketHasDefault) return;
    saveFilterDefault(FILTER_DEFAULT_KEYS.vaultPackets, {
      status: packetStatusFilter,
      vendor: packetVendorFilter,
      sowMonth: packetSowMonth,
      sortBy: packetSortBy,
      sortDirection: packetSortDirection,
    });
    setPacketHasDefault(true);
  }, [packetStatusFilter, packetVendorFilter, packetSowMonth, packetSortBy, packetSortDirection, setPacketHasDefault]);

  if (!ctx || !ctx.refineByOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/40"
        aria-hidden
        onClick={closeModal}
      />
      <div
        className="fixed left-4 right-4 top-1/2 z-[101] -translate-y-1/2 rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col max-w-md mx-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="packet-refine-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-black/10">
          <h2 id="packet-refine-title" className="text-lg font-semibold text-black">Filter</h2>
          <div className="flex items-center gap-1">
            {(hasPacketActiveFilters ?? false) && (
              <button
                type="button"
                onClick={() => clearPacketFilters?.()}
                className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                aria-label="Clear all filters"
              >
                Clear filters
              </button>
            )}
            <button
              type="button"
              onClick={closeModal}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-black/60 hover:bg-black/5 hover:text-black"
              aria-label="Close"
            >
              <span className="text-xl leading-none" aria-hidden>×</span>
            </button>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Sort */}
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setRefineBySection?.((s) => (s === "sort" ? null : "sort"))}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={refineBySection === "sort"}
            >
              <span>Sort</span>
              <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "sort" ? "▼" : "▸"}</span>
            </button>
            {refineBySection === "sort" && (
              <div className="px-4 pb-3 pt-0 space-y-0.5">
                {[
                  { sortBy: "date" as const, sortDirection: "desc" as const, label: "Date (newest first)" },
                  { sortBy: "date" as const, sortDirection: "asc" as const, label: "Date (oldest first)" },
                  { sortBy: "variety" as const, sortDirection: "asc" as const, label: "Variety (A–Z)" },
                  { sortBy: "variety" as const, sortDirection: "desc" as const, label: "Variety (Z–A)" },
                  { sortBy: "vendor" as const, sortDirection: "asc" as const, label: "Vendor (A–Z)" },
                  { sortBy: "vendor" as const, sortDirection: "desc" as const, label: "Vendor (Z–A)" },
                  { sortBy: "qty" as const, sortDirection: "desc" as const, label: "Quantity (high first)" },
                  { sortBy: "qty" as const, sortDirection: "asc" as const, label: "Quantity (low first)" },
                  { sortBy: "rating" as const, sortDirection: "desc" as const, label: "Rating (high first)" },
                  { sortBy: "rating" as const, sortDirection: "asc" as const, label: "Rating (low first)" },
                ].map(({ sortBy: sb, sortDirection: sd, label }) => {
                  const selected = packetSortBy === sb && packetSortDirection === sd;
                  return (
                    <button
                      key={`${sb}-${sd}`}
                      type="button"
                      onClick={() => { setPacketSortBy?.(sb); setPacketSortDirection?.(sd); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Status */}
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setRefineBySection?.((s) => (s === "vault" ? null : "vault"))}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={refineBySection === "vault"}
            >
              <span>Vault Status</span>
              <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "vault" ? "▼" : "▸"}</span>
            </button>
            {refineBySection === "vault" && (
              <div className="px-4 pb-3 pt-0 space-y-0.5">
                {statusOptions.map(({ value, label, count }) => {
                  const selected = packetStatusFilter === value;
                  return (
                    <button
                      key={value || "all"}
                      type="button"
                      onClick={() => setPacketStatusFilter?.(value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Vendor */}
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setRefineBySection?.((s) => (s === "packetVendor" ? null : "packetVendor"))}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={refineBySection === "packetVendor"}
            >
              <span>Vendor</span>
              <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "packetVendor" ? "▼" : "▸"}</span>
            </button>
            {refineBySection === "packetVendor" && (
              <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                <button
                  type="button"
                  onClick={() => setPacketVendorFilter?.(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${packetVendorFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                >
                  All
                </button>
                {(packetVendorChips ?? []).map(({ value, count }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPacketVendorFilter?.(value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] truncate ${packetVendorFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                  >
                    {value} ({count})
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Sow Month */}
          <div className="border-b border-black/5">
            <button
              type="button"
              onClick={() => setRefineBySection?.((s) => (s === "packetSow" ? null : "packetSow"))}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
              aria-expanded={refineBySection === "packetSow"}
            >
              <span>Plant this month</span>
              <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "packetSow" ? "▼" : "▸"}</span>
            </button>
            {refineBySection === "packetSow" && (
              <div className="px-4 pb-3 pt-0 space-y-0.5">
                <button
                  type="button"
                  onClick={() => { setPacketSowMonth?.(null); router?.replace("/vault?tab=list", { scroll: false }); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${!packetSowMonth ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const sow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                    setPacketSowMonth?.(sow);
                    router?.replace(`/vault?tab=list&sow=${sow}`, { scroll: false });
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${
                    packetSowMonth && /^\d{4}-\d{2}$/.test(packetSowMonth) && packetSowMonth === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
                      ? "bg-emerald/10 text-emerald-800 font-medium"
                      : "text-black/80 hover:bg-black/5"
                  }`}
                >
                  Plant Now
                </button>
              </div>
            )}
          </div>
          {/* Tags */}
          {(packetAvailableTags ?? []).filter((t) => !isSeedTypeTag(t)).length > 0 && (
            <div className="border-b border-black/5">
              <button
                type="button"
                onClick={() => setRefineBySection?.((s) => (s === "tags" ? null : "tags"))}
                className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                aria-expanded={refineBySection === "tags"}
              >
                <span>Tags</span>
                <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "tags" ? "▼" : "▸"}</span>
              </button>
              {refineBySection === "tags" && (
                <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                  {(packetAvailableTags ?? []).filter((t) => !isSeedTypeTag(t)).map((tag) => {
                    const checked = vaultFilters?.filters.tags.includes(tag);
                    return (
                      <label
                        key={tag}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => vaultFilters?.toggleTagFilter(tag)}
                          className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                          aria-label={`Filter by ${tag}`}
                        />
                        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${getTagStyle(tag)}`}>
                          {tag}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* Seed Type */}
          {(packetSeedTypeChips ?? []).length > 0 && (
            <div className="border-b border-black/5">
              <button
                type="button"
                onClick={() => setRefineBySection?.((s) => (s === "seedType" ? null : "seedType"))}
                className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                aria-expanded={refineBySection === "seedType"}
              >
                <span>Seed Type</span>
                <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "seedType" ? "▼" : "▸"}</span>
              </button>
              {refineBySection === "seedType" && (
                <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                  {(packetSeedTypeChips ?? []).map(({ value, count }) => {
                    const checked = vaultFilters?.filters.seedTypes.includes(value);
                    return (
                      <label
                        key={value}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => vaultFilters?.toggleSeedTypeFilter(value)}
                          className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                          aria-label={`Filter by ${value}`}
                        />
                        <span className="text-sm text-black/80">{value} ({count})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="flex-shrink-0 border-t border-black/10 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            {!(packetHasDefault ?? false) && (
              <button
                type="button"
                onClick={saveAsDefault}
                className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                aria-label="Save current filters as default"
              >
                Save Default
              </button>
            )}
            {(packetHasDefault ?? false) && (
              <button
                type="button"
                onClick={() => { clearFilterDefault(FILTER_DEFAULT_KEYS.vaultPackets); setPacketHasDefault?.(false); }}
                className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-black/60 hover:bg-black/5"
                aria-label="Reset saved default filters"
              >
                Reset Default
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="w-full min-h-[48px] rounded-xl bg-emerald text-white font-medium text-sm"
          >
            Show Results ({(filteredPacketCount ?? 0)})
          </button>
        </footer>
      </div>
    </>
  );
}

/** List-only modals: selection actions menu, batch packet delete confirm, EditPacketModal. */
export function VaultPacketWingModals() {
  const ctx = useContext(VaultPacketWingContext);
  if (!ctx || ctx.viewMode !== "list") return null;
  const {
    selectionActionsOpen,
    setSelectionActionsOpen,
    batchSelectMode,
    selectedPacketIds,
    setSelectedPacketIds,
    setBatchSelectMode,
    setBatchPacketDeleteConfirmOpen,
    batchPacketDeleteConfirmOpen,
    setEditPacketId,
    setEditPacketModalOpen,
    editPacketId,
    editPacketModalOpen,
    refetch,
    batchPacketDeleting,
    handleBatchDeletePackets,
  } = ctx;

  return (
    <>
      {/* Selection actions menu (packet list) */}
      {selectionActionsOpen && batchSelectMode && (
        <>
          <div
            className="fixed inset-0 z-[99] bg-black/40"
            aria-hidden
            onClick={() => setSelectionActionsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Selection actions"
            className="fixed left-4 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px)+1rem)] z-[100] rounded-2xl bg-white shadow-xl border border-black/10 overflow-hidden max-h-[70vh] flex flex-col"
          >
            <div className="flex-shrink-0 px-4 py-3 border-b border-black/10">
              <p className="text-sm font-medium text-black/70">{selectedPacketIds.size} selected</p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <button
                type="button"
                onClick={() => {
                  setBatchPacketDeleteConfirmOpen(true);
                  setSelectionActionsOpen(false);
                }}
                disabled={selectedPacketIds.size === 0 || batchPacketDeleting}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-citrus hover:bg-black/5 disabled:opacity-50"
                aria-label="Delete selected"
              >
                <ICON_MAP.Trash2 className="w-5 h-5 shrink-0" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => {
                  const first = Array.from(selectedPacketIds)[0];
                  if (first) {
                    setEditPacketId(first);
                    setEditPacketModalOpen(true);
                  }
                  setSelectionActionsOpen(false);
                }}
                disabled={selectedPacketIds.size !== 1}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/80 hover:bg-black/5 disabled:opacity-50"
                aria-label="Edit selected packet"
              >
                <ICON_MAP.Pencil className="w-5 h-5 shrink-0" />
                Edit
              </button>
            </div>
          </div>
        </>
      )}

      {/* Batch packet delete confirm */}
      {batchPacketDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="alertdialog" aria-modal="true" aria-labelledby="batch-packet-delete-title">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full p-6">
            <h2 id="batch-packet-delete-title" className="text-lg font-semibold text-black mb-2">Delete {selectedPacketIds.size} seed packet{selectedPacketIds.size !== 1 ? "s" : ""}?</h2>
            <p className="text-sm text-black/70 mb-3">Choose how to handle related data:</p>
            <div className="flex flex-col gap-2 mb-4">
              <button
                type="button"
                onClick={() => handleBatchDeletePackets(false)}
                disabled={batchPacketDeleting}
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 min-h-[44px] disabled:opacity-50 text-left"
              >
                <span className="block font-medium">Delete packet only</span>
                <span className="block text-xs text-black/60 mt-0.5">Removes packets and journal entries. Plantings kept; packet link cleared.</span>
              </button>
              <button
                type="button"
                onClick={() => handleBatchDeletePackets(true)}
                disabled={batchPacketDeleting}
                className="w-full px-4 py-2.5 rounded-lg border border-red-200 text-red-700 font-medium hover:bg-red-50 min-h-[44px] disabled:opacity-50 text-left"
              >
                <span className="block font-medium">Delete packet and all related</span>
                <span className="block text-xs text-red-600/80 mt-0.5">Removes packets, journal entries, and plantings started from these packets.</span>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setBatchPacketDeleteConfirmOpen(false)}
                disabled={batchPacketDeleting}
                className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 min-h-[44px] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editPacketModalOpen && editPacketId && (
        <EditPacketModal
          packetId={editPacketId}
          onClose={() => {
            setEditPacketModalOpen(false);
            setEditPacketId(null);
            setSelectedPacketIds(new Set());
            setBatchSelectMode(false);
          }}
          onSaved={() => {
            refetch();
            setSelectedPacketIds(new Set());
            setBatchSelectMode(false);
          }}
        />
      )}
    </>
  );
}
