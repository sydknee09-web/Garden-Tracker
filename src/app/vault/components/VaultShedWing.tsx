"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";
import {
  loadFilterDefault,
  saveFilterDefault,
  clearFilterDefault,
  hasFilterDefault,
  FILTER_DEFAULT_KEYS,
} from "@/lib/filterDefaults";
import { ICON_MAP } from "@/lib/styleDictionary";

const ShedView = dynamic(
  () => import("@/components/ShedView").then((m) => ({ default: m.ShedView })),
  { ssr: false, loading: () => <div className="min-h-[200px] flex items-center justify-center text-neutral-500">Loading shed…</div> }
);
const QuickAddSupply = dynamic(
  () => import("@/components/QuickAddSupply").then((m) => ({ default: m.QuickAddSupply })),
  { ssr: false }
);
const BatchAddSupply = dynamic(
  () => import("@/components/BatchAddSupply").then((m) => ({ default: m.BatchAddSupply })),
  { ssr: false }
);

export type VaultShedWingContextValue = {
  viewMode: "grid" | "list" | "shed";
  shedSearchQuery: string;
  setShedSearchQuery: (v: string) => void;
  shedCategoryFilter: string | null;
  setShedCategoryFilter: (v: string | null) => void;
  shedHasDefault: boolean;
  setShedHasDefault: (v: boolean) => void;
  shedBatchSelectMode: boolean;
  setShedBatchSelectMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  selectedSupplyIds: Set<string>;
  setSelectedSupplyIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  shedFilterOpen: boolean;
  setShedFilterOpen: (v: boolean) => void;
  shedSortBy: "name" | "updated_at" | "last_used" | "category";
  setShedSortBy: (v: "name" | "updated_at" | "last_used" | "category") => void;
  shedSortDir: "asc" | "desc";
  setShedSortDir: (v: "asc" | "desc") => void;
  shedDisplayStyle: "grid" | "list";
  setShedDisplayStyle: (v: "grid" | "list" | ((prev: "grid" | "list") => "grid" | "list")) => void;
  shedBatchDeleting: boolean;
  filteredSupplyIds: string[];
  setFilteredSupplyIds: (v: string[]) => void;
  shedSelectionActionsOpen: boolean;
  setShedSelectionActionsOpen: (v: boolean) => void;
  shedQuickAddOpen: boolean;
  setShedQuickAddOpen: (v: boolean) => void;
  batchAddSupplyOpen: boolean;
  setBatchAddSupplyOpen: (v: boolean) => void;
  refetch: () => void;
  refetchTrigger: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  handleShedBatchDelete: () => Promise<void>;
  shedModalOpen: boolean;
  openSelectionActions: () => void;
  openQuickAdd: () => void;
  router: ReturnType<typeof useRouter>;
  shedCategoryFromUrl: string | null;
  closeAllShedModals: () => void;
};

const VaultShedWingContext = createContext<VaultShedWingContextValue | null>(null);

export function useVaultShedWing(): VaultShedWingContextValue {
  const ctx = useContext(VaultShedWingContext);
  if (!ctx) throw new Error("useVaultShedWing must be used within VaultShedWingProvider");
  return ctx;
}

export function useVaultShedWingOptional(): VaultShedWingContextValue | null {
  return useContext(VaultShedWingContext);
}

/** Syncs shed modal open and selection state to parent for FAB and useModalBackClose. Render inside VaultShedWingProvider. */
export function VaultShedWingBridge({
  onShedModalOpenChange,
  onShedSelectionStateChange,
  shedActionsRef,
}: {
  onShedModalOpenChange: (open: boolean) => void;
  onShedSelectionStateChange: (state: { shedBatchSelectMode: boolean; selectedSupplyIds: Set<string> }) => void;
  shedActionsRef: React.MutableRefObject<{
    openSelectionActions: () => void;
    openQuickAdd: () => void;
    closeAllShedModals: () => void;
  } | null>;
}) {
  const wing = useVaultShedWingOptional();
  useEffect(() => {
    onShedModalOpenChange(wing?.shedModalOpen ?? false);
  }, [wing?.shedModalOpen, onShedModalOpenChange]);
  useEffect(() => {
    if (!wing) return;
    onShedSelectionStateChange({
      shedBatchSelectMode: wing.shedBatchSelectMode,
      selectedSupplyIds: wing.selectedSupplyIds,
    });
  }, [wing?.shedBatchSelectMode, wing?.selectedSupplyIds, onShedSelectionStateChange]);
  useEffect(() => {
    if (wing) {
      shedActionsRef.current = {
        openSelectionActions: wing.openSelectionActions,
        openQuickAdd: wing.openQuickAdd,
        closeAllShedModals: wing.closeAllShedModals,
      };
    } else {
      shedActionsRef.current = null;
    }
    return () => {
      shedActionsRef.current = null;
    };
  }, [wing, shedActionsRef]);
  return null;
}

type VaultShedWingProviderProps = {
  viewMode: "grid" | "list" | "shed";
  children: ReactNode;
  pendingShedActionRef: React.MutableRefObject<"quickAdd" | null>;
  onSaveMessage: (message: string) => void;
};

export function VaultShedWingProvider({
  viewMode,
  children,
  pendingShedActionRef,
  onSaveMessage,
}: VaultShedWingProviderProps) {
  const { user } = useAuth();
  const { refetchTrigger, refetch, scrollContainerRef } = useVault();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [shedSearchQuery, setShedSearchQuery] = useState("");
  const [shedCategoryFilter, setShedCategoryFilter] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const loaded = loadFilterDefault<string>(FILTER_DEFAULT_KEYS.vaultShed);
    if (typeof loaded === "string" && ["fertilizer", "pesticide", "soil_amendment", "other"].includes(loaded)) return loaded;
    return null;
  });
  const [shedHasDefault, setShedHasDefault] = useState(() => hasFilterDefault(FILTER_DEFAULT_KEYS.vaultShed));
  const [shedBatchSelectMode, setShedBatchSelectMode] = useState(false);
  const [selectedSupplyIds, setSelectedSupplyIds] = useState<Set<string>>(new Set());
  const [shedFilterOpen, setShedFilterOpen] = useState(false);
  const [shedSortBy, setShedSortBy] = useState<"name" | "updated_at" | "last_used" | "category">("updated_at");
  const [shedSortDir, setShedSortDir] = useState<"asc" | "desc">("desc");
  const [shedDisplayStyle, setShedDisplayStyle] = useState<"grid" | "list">("list");
  const [shedBatchDeleting, setShedBatchDeleting] = useState(false);
  const [filteredSupplyIds, setFilteredSupplyIds] = useState<string[]>([]);
  const [shedSelectionActionsOpen, setShedSelectionActionsOpen] = useState(false);
  const [shedQuickAddOpen, setShedQuickAddOpen] = useState(false);
  const [batchAddSupplyOpen, setBatchAddSupplyOpen] = useState(false);

  const shedStyleRestoredRef = useRef(false);

  const shedCategoryFromUrl = searchParams.get("category");
  useEffect(() => {
    if (viewMode === "shed" && shedCategoryFromUrl && ["fertilizer", "pesticide", "soil_amendment", "other"].includes(shedCategoryFromUrl)) {
      setShedCategoryFilter(shedCategoryFromUrl);
    }
  }, [viewMode, shedCategoryFromUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("vault-shed-display-style", shedDisplayStyle);
    } catch {
      /* ignore */
    }
  }, [shedDisplayStyle]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("vault-shed-sort", JSON.stringify({ sortBy: shedSortBy, sortDir: shedSortDir }));
    } catch {
      /* ignore */
    }
  }, [shedSortBy, shedSortDir]);
  useEffect(() => {
    if (shedStyleRestoredRef.current || typeof window === "undefined") return;
    shedStyleRestoredRef.current = true;
    try {
      const saved = sessionStorage.getItem("vault-shed-display-style");
      if (saved === "grid" || saved === "list") setShedDisplayStyle(saved);
      const sortRaw = sessionStorage.getItem("vault-shed-sort");
      if (sortRaw) {
        const parsed = JSON.parse(sortRaw) as { sortBy?: string; sortDir?: string };
        if (["name", "updated_at", "last_used", "category"].includes(parsed.sortBy ?? "")) {
          setShedSortBy(parsed.sortBy as "name" | "updated_at" | "last_used" | "category");
        }
        if (parsed.sortDir === "asc" || parsed.sortDir === "desc") setShedSortDir(parsed.sortDir);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (viewMode !== "shed") return;
    const action = pendingShedActionRef.current;
    if (action === "quickAdd") {
      pendingShedActionRef.current = null;
      setShedQuickAddOpen(true);
    }
  }, [viewMode, pendingShedActionRef]);

  const handleShedBatchDelete = useCallback(async () => {
    if (selectedSupplyIds.size === 0) return;
    const uid = user?.id;
    if (!uid) {
      onSaveMessage("You must be signed in to delete.");
      return;
    }
    setShedBatchDeleting(true);
    const now = new Date().toISOString();
    const ids = Array.from(selectedSupplyIds);
    const { error } = await supabase
      .from("supply_profiles")
      .update({ deleted_at: now })
      .in("id", ids)
      .eq("user_id", uid);
    setShedBatchDeleting(false);
    if (error) {
      onSaveMessage(`Could not delete: ${error.message}`);
      return;
    }
    const count = ids.length;
    setSelectedSupplyIds(new Set());
    setShedBatchSelectMode(false);
    refetch();
    onSaveMessage(`${count} supply${count === 1 ? "" : " supplies"} removed.`);
  }, [user?.id, selectedSupplyIds, refetch, onSaveMessage]);

  const shedModalOpen =
    shedQuickAddOpen || batchAddSupplyOpen || shedFilterOpen || shedSelectionActionsOpen;

  const openSelectionActions = useCallback(() => {
    setShedSelectionActionsOpen(true);
  }, []);
  const openQuickAdd = useCallback(() => {
    setShedQuickAddOpen(true);
  }, []);

  const closeAllShedModals = useCallback(() => {
    setShedQuickAddOpen(false);
    setBatchAddSupplyOpen(false);
    setShedFilterOpen(false);
    setShedSelectionActionsOpen(false);
  }, []);

  const value: VaultShedWingContextValue = useMemo(
    () => ({
      viewMode,
      shedSearchQuery,
      setShedSearchQuery,
      shedCategoryFilter,
      setShedCategoryFilter,
      shedHasDefault,
      setShedHasDefault,
      shedBatchSelectMode,
      setShedBatchSelectMode,
      selectedSupplyIds,
      setSelectedSupplyIds,
      shedFilterOpen,
      setShedFilterOpen,
      shedSortBy,
      setShedSortBy,
      shedSortDir,
      setShedSortDir,
      shedDisplayStyle,
      setShedDisplayStyle,
      shedBatchDeleting,
      filteredSupplyIds,
      setFilteredSupplyIds,
      shedSelectionActionsOpen,
      setShedSelectionActionsOpen,
      shedQuickAddOpen,
      setShedQuickAddOpen,
      batchAddSupplyOpen,
      setBatchAddSupplyOpen,
      refetch,
      refetchTrigger,
      scrollContainerRef,
      handleShedBatchDelete,
      shedModalOpen,
      openSelectionActions,
      openQuickAdd,
      router,
      shedCategoryFromUrl,
      closeAllShedModals,
    }),
    [
      viewMode,
      shedSearchQuery,
      shedCategoryFilter,
      shedHasDefault,
      shedBatchSelectMode,
      selectedSupplyIds,
      shedFilterOpen,
      shedSortBy,
      shedSortDir,
      shedDisplayStyle,
      shedBatchDeleting,
      filteredSupplyIds,
      shedSelectionActionsOpen,
      shedQuickAddOpen,
      batchAddSupplyOpen,
      refetch,
      refetchTrigger,
      scrollContainerRef,
      handleShedBatchDelete,
      shedModalOpen,
      openSelectionActions,
      openQuickAdd,
      router,
      shedCategoryFromUrl,
      closeAllShedModals,
    ]
  );

  return (
    <VaultShedWingContext.Provider value={value}>
      {children}
    </VaultShedWingContext.Provider>
  );
}

export function VaultShedWingToolbar() {
  const ctx = useContext(VaultShedWingContext);
  if (!ctx || ctx.viewMode !== "shed") return null;
  const {
    shedSearchQuery,
    setShedSearchQuery,
    shedCategoryFilter,
    setShedCategoryFilter,
    shedFilterOpen,
    setShedFilterOpen,
    shedBatchSelectMode,
    setShedBatchSelectMode,
    selectedSupplyIds,
    setSelectedSupplyIds,
    filteredSupplyIds,
    shedDisplayStyle,
    setShedDisplayStyle,
    router,
  } = ctx;
  return (
    <>
      <div className="flex gap-2 mb-2">
        <div className="flex-1 relative">
          <ICON_MAP.Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-black/40 pointer-events-none" aria-hidden />
          <input
            type="search"
            value={shedSearchQuery}
            onChange={(e) => setShedSearchQuery(e.target.value)}
            placeholder="Search supplies…"
            className="w-full rounded-xl bg-neutral-100 border-0 pl-10 pr-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:ring-inset min-h-[44px]"
            aria-label="Search supplies"
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 gap-y-2 relative z-40">
          <button
            type="button"
            onClick={() => setShedFilterOpen(true)}
            className={`min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 flex items-center gap-2 shrink-0 ${shedCategoryFilter ? "ring-2 ring-emerald/40" : ""}`}
            aria-label="Filter by category"
          >
            <ICON_MAP.Filter className="w-5 h-5 shrink-0" />
            Filter
            {shedCategoryFilter && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald text-white text-xs font-semibold">1</span>
            )}
          </button>
          {shedCategoryFilter && (
            <button
              type="button"
              onClick={() => {
                setShedCategoryFilter(null);
                router.replace("/vault?tab=shed", { scroll: false });
              }}
              className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald/10 shrink-0"
              aria-label="Clear category filter"
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (shedBatchSelectMode) {
                setShedBatchSelectMode(false);
                setSelectedSupplyIds(new Set());
              } else {
                setShedBatchSelectMode(true);
              }
            }}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 shrink-0"
          >
            {shedBatchSelectMode ? "Cancel" : "Select"}
          </button>
          {shedBatchSelectMode && filteredSupplyIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSupplyIds(new Set(filteredSupplyIds))}
              className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5"
              id="shed-select-all"
            >
              Select All
            </button>
          )}
          <button
            type="button"
            onClick={() => setShedDisplayStyle((s) => (s === "grid" ? "list" : "grid"))}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-black/10 bg-white ml-auto hover:bg-black/5 transition-colors"
            title={shedDisplayStyle === "grid" ? "List view" : "Grid view"}
            aria-label={shedDisplayStyle === "grid" ? "Switch to list view" : "Switch to grid view"}
          >
            {shedDisplayStyle === "grid" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            ) : (
              <ICON_MAP.PhotoCardsGrid className="w-5 h-5" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export function VaultShedWingContent() {
  const ctx = useContext(VaultShedWingContext);
  if (!ctx || ctx.viewMode !== "shed") return null;
  const {
    refetchTrigger,
    scrollContainerRef,
    shedSearchQuery,
    shedCategoryFilter,
    shedSortBy,
    shedSortDir,
    shedDisplayStyle,
    shedBatchSelectMode,
    selectedSupplyIds,
    setSelectedSupplyIds,
    setFilteredSupplyIds,
    shedCategoryFromUrl,
  } = ctx;
  return (
    <div className="relative z-10 pt-2 pointer-events-auto">
      <ShedView
        embedded
        refetchTrigger={refetchTrigger}
        categoryFromUrl={shedCategoryFromUrl}
        scrollContainerRef={scrollContainerRef}
        searchQuery={shedSearchQuery}
        categoryFilter={shedCategoryFilter}
        sortBy={shedSortBy}
        sortDir={shedSortDir}
        displayStyle={shedDisplayStyle}
        batchSelectMode={shedBatchSelectMode}
        selectedIds={selectedSupplyIds}
        onToggleSelection={(id) => {
          setSelectedSupplyIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onLongPress={(id) => {
          ctx.setShedBatchSelectMode(true);
          setSelectedSupplyIds((prev) => new Set([...prev, id]));
        }}
        onFilteredIdsChange={setFilteredSupplyIds}
      />
    </div>
  );
}

export function VaultShedWingModals({
  onOpenUniversalAddMenu,
  onOpenPurchaseOrderSupply,
  skipPopOnNavigateRef,
}: {
  onOpenUniversalAddMenu?: () => void;
  onOpenPurchaseOrderSupply?: () => void;
  skipPopOnNavigateRef?: React.MutableRefObject<boolean>;
}) {
  const ctx = useContext(VaultShedWingContext);
  if (!ctx) return null;
  const {
    viewMode,
    shedFilterOpen,
    setShedFilterOpen,
    shedCategoryFilter,
    setShedCategoryFilter,
    shedHasDefault,
    setShedHasDefault,
    shedSortBy,
    setShedSortBy,
    shedSortDir,
    setShedSortDir,
    shedSelectionActionsOpen,
    setShedSelectionActionsOpen,
    shedBatchSelectMode,
    handleShedBatchDelete,
    selectedSupplyIds,
    shedBatchDeleting,
    shedQuickAddOpen,
    setShedQuickAddOpen,
    batchAddSupplyOpen,
    setBatchAddSupplyOpen,
    refetch,
    router,
  } = ctx;

  return (
    <>
      {/* QuickAddSupply and BatchAddSupply: always render when provider is mounted so "Add to shed" from Universal Add works without leaving current tab */}
      <QuickAddSupply
        open={shedQuickAddOpen}
        onClose={() => setShedQuickAddOpen(false)}
        onSuccess={() => refetch()}
        onBackToMenu={() => {
          setShedQuickAddOpen(false);
          onOpenUniversalAddMenu?.();
        }}
        onOpenPurchaseOrder={() => {
          if (skipPopOnNavigateRef) skipPopOnNavigateRef.current = true;
          setShedQuickAddOpen(false);
          onOpenPurchaseOrderSupply?.();
        }}
        onOpenBatchPhotoImport={() => {
          if (skipPopOnNavigateRef) skipPopOnNavigateRef.current = true;
          setShedQuickAddOpen(false);
          setBatchAddSupplyOpen(true);
        }}
      />

      {batchAddSupplyOpen && (
        <BatchAddSupply
          open={batchAddSupplyOpen}
          onClose={() => setBatchAddSupplyOpen(false)}
          onSuccess={() => refetch()}
        />
      )}

      {/* Shed-only modals: filter and selection actions */}
      {viewMode === "shed" && (
      {/* Shed category filter modal */}
      {shedFilterOpen && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/40"
            aria-hidden
            onClick={() => setShedFilterOpen(false)}
          />
          <div
            className="fixed left-4 right-4 top-1/2 z-[101] -translate-y-1/2 rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col max-w-md mx-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shed-filter-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-black/10">
              <h2 id="shed-filter-title" className="text-lg font-semibold text-black">Filter & Sort</h2>
              <button
                type="button"
                onClick={() => setShedFilterOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-black/60 hover:bg-black/5 hover:text-black"
                aria-label="Close"
              >
                <span className="text-xl leading-none" aria-hidden>×</span>
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-black/70 mb-2">Filter by category</h3>
                <div className="space-y-1">
                  {[
                    { value: null, label: "All" },
                    { value: "fertilizer", label: "Fertilizer" },
                    { value: "pesticide", label: "Pesticide" },
                    { value: "soil_amendment", label: "Soil Amendment" },
                    { value: "other", label: "Other" },
                  ].map(({ value, label }) => {
                    const selected = shedCategoryFilter === value;
                    return (
                      <button
                        key={value ?? "all"}
                        type="button"
                        onClick={() => {
                          setShedCategoryFilter(value);
                          router.replace(value ? `/vault?tab=shed&category=${value}` : "/vault?tab=shed", { scroll: false });
                          setShedFilterOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-black/70 mb-2">Sort by</h3>
                <div className="space-y-1">
                  {[
                    { value: "updated_at" as const, label: "Date added" },
                    { value: "name" as const, label: "Name" },
                    { value: "last_used" as const, label: "Last used" },
                    { value: "category" as const, label: "Category" },
                  ].map(({ value, label }) => {
                    const selected = shedSortBy === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setShedSortBy(value);
                          setShedFilterOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShedSortDir("asc")}
                    className={`flex-1 min-h-[44px] py-2 rounded-lg text-sm font-medium ${shedSortDir === "asc" ? "bg-emerald/10 text-emerald-800" : "text-black/60 hover:bg-black/5"}`}
                  >
                    A → Z
                  </button>
                  <button
                    type="button"
                    onClick={() => setShedSortDir("desc")}
                    className={`flex-1 min-h-[44px] py-2 rounded-lg text-sm font-medium ${shedSortDir === "desc" ? "bg-emerald/10 text-emerald-800" : "text-black/60 hover:bg-black/5"}`}
                  >
                    Z → A
                  </button>
                </div>
              </div>
            </div>
            <footer className="flex-shrink-0 border-t border-black/10 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                {!shedHasDefault && (
                  <button
                    type="button"
                    onClick={() => {
                      saveFilterDefault(FILTER_DEFAULT_KEYS.vaultShed, shedCategoryFilter);
                      setShedHasDefault(true);
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                    aria-label="Save current filter as default"
                  >
                    Save Default
                  </button>
                )}
                {shedHasDefault && (
                  <button
                    type="button"
                    onClick={() => {
                      clearFilterDefault(FILTER_DEFAULT_KEYS.vaultShed);
                      setShedHasDefault(false);
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-black/60 hover:bg-black/5"
                    aria-label="Reset saved default filter"
                  >
                    Reset Default
                  </button>
                )}
              </div>
            </footer>
          </div>
        </>
      )}

      {/* Shed selection actions menu */}
      {shedSelectionActionsOpen && shedBatchSelectMode && (
        <>
          <div
            className="fixed inset-0 z-[99] bg-black/40"
            aria-hidden
            onClick={() => setShedSelectionActionsOpen(false)}
          />
          <div
            role="menu"
            aria-label="Shed selection actions"
            className="fixed left-4 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px)+1rem)] z-[100] rounded-2xl bg-white shadow-xl border border-black/10 overflow-hidden max-h-[70vh] flex flex-col"
          >
            <div className="flex-1 overflow-y-auto py-2">
              <button
                type="button"
                onClick={() => {
                  handleShedBatchDelete();
                  setShedSelectionActionsOpen(false);
                }}
                disabled={selectedSupplyIds.size === 0 || shedBatchDeleting}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-citrus hover:bg-black/5 disabled:opacity-50"
                aria-label="Delete selected"
              >
                <ICON_MAP.Trash2 className="w-5 h-5 shrink-0" />
                Delete
              </button>
            </div>
          </div>
        </>
      )}
      </>
      )}
    </>
  );
}
