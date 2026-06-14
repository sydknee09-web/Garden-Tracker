"use client";

import { useState, useCallback } from "react";
import {
  loadFilterDefault,
  saveFilterDefault,
  clearFilterDefault,
  hasFilterDefault,
} from "@/lib/filterDefaults";

/** Inventory/lifecycle toggle keys (Phase 2b). Library uses all 4; Packets uses hasPackets + prevOwned; Garden uses none. */
export type InventoryToggleKey = "growing" | "hasPackets" | "prevGrown" | "prevOwned";

/** Common filter values shared by Garden and Vault. */
export type GardenFilterValues = {
  variety: string | null;
  /** Canonical plant_profiles.plant_category (Vegetable, Fruit, Herb, Flower, Ornamental, Houseplant). Primary-chip filter dim (Sprint 11.5). */
  plantCategory: string | null;
  sun: string | null;
  spacing: string | null;
  germination: string | null;
  maturity: string | null;
  tags: string[];
  /** Plant-in-month picker (1–12). null = inactive (Phase 2b). Replaces old Season + plant-this-month. */
  plantMonth: number | null;
  /** Plant-name multi-select (Phase 2b). Empty = inactive. OR semantics. */
  plantNames: string[];
};

/** Vault extends Garden with vendor, packetCount, method, and inventory toggles. */
export type VaultFilterValues = GardenFilterValues & {
  vendor: string | null;
  packetCount: string | null;
  /** Planting method (indoors | outdoors) from the frost-offset structured fields. */
  method: string | null;
  /** Inventory/lifecycle toggles (Phase 2b — replace the single Status dropdown). */
  invGrowing: boolean;
  invHasPackets: boolean;
  invPrevGrown: boolean;
  invPrevOwned: boolean;
};

export type FilterSchema = "garden" | "vault";

const EMPTY_GARDEN: GardenFilterValues = {
  variety: null,
  plantCategory: null,
  sun: null,
  spacing: null,
  germination: null,
  maturity: null,
  tags: [],
  plantMonth: null,
  plantNames: [],
};

const EMPTY_VAULT: VaultFilterValues = {
  ...EMPTY_GARDEN,
  vendor: null,
  packetCount: null,
  method: null,
  invGrowing: false,
  invHasPackets: false,
  invPrevGrown: false,
  invPrevOwned: false,
};

function countActiveGardenFilters(f: GardenFilterValues): number {
  return [
    f.variety !== null,
    f.plantCategory !== null,
    f.sun !== null,
    f.spacing !== null,
    f.germination !== null,
    f.maturity !== null,
    f.tags.length > 0,
    f.plantMonth !== null,
    f.plantNames.length > 0,
  ].filter(Boolean).length;
}

function countActiveVaultFilters(f: VaultFilterValues): number {
  return (
    countActiveGardenFilters(f) +
    [
      f.vendor !== null,
      f.packetCount !== null,
      f.method !== null,
      f.invGrowing,
      f.invHasPackets,
      f.invPrevGrown,
      f.invPrevOwned,
    ].filter(Boolean).length
  );
}

function hasActiveGardenFilters(f: GardenFilterValues): boolean {
  return countActiveGardenFilters(f) > 0;
}

function hasActiveVaultFilters(f: VaultFilterValues): boolean {
  return countActiveVaultFilters(f) > 0;
}

function normalizeGardenLoaded(raw: unknown): GardenFilterValues | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    variety: typeof o.variety === "string" ? o.variety : null,
    plantCategory: typeof o.plantCategory === "string" ? o.plantCategory : null,
    sun: typeof o.sun === "string" ? o.sun : null,
    spacing: typeof o.spacing === "string" ? o.spacing : null,
    germination: typeof o.germination === "string" ? o.germination : null,
    maturity: typeof o.maturity === "string" ? o.maturity : null,
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string") : [],
    plantMonth: typeof o.plantMonth === "number" && o.plantMonth >= 1 && o.plantMonth <= 12 ? o.plantMonth : null,
    plantNames: Array.isArray(o.plantNames) ? o.plantNames.filter((t): t is string => typeof t === "string") : [],
  };
}

function normalizeVaultLoaded(raw: unknown): VaultFilterValues | null {
  const garden = normalizeGardenLoaded(raw);
  if (!garden) return null;
  const o = raw as Record<string, unknown>;
  return {
    ...garden,
    vendor: typeof o.vendor === "string" ? o.vendor : null,
    packetCount: typeof o.packetCount === "string" ? o.packetCount : null,
    method: typeof o.method === "string" ? o.method : null,
    invGrowing: o.invGrowing === true,
    invHasPackets: o.invHasPackets === true,
    invPrevGrown: o.invPrevGrown === true,
    invPrevOwned: o.invPrevOwned === true,
  };
}

function extractSortFromLoaded(raw: unknown): { sortBy: string; sortDir: "asc" | "desc" } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sortBy = typeof o.sortBy === "string" ? o.sortBy : null;
  const sortDir = o.sortDir === "asc" || o.sortDir === "desc" ? o.sortDir : o.sortDirection === "asc" || o.sortDirection === "desc" ? o.sortDirection : null;
  if (sortBy && sortDir) return { sortBy, sortDir };
  return null;
}

export type UseFilterStateOptions<T extends FilterSchema> = {
  schema: T;
  /** Called after clearing filters (e.g. router.replace to clear URL params). */
  onClear?: () => void;
  /** Additional check for hasActiveFilters (e.g. sowParam from URL). */
  isFilterActive?: () => boolean;
  /** localStorage key for save/restore default (e.g. "garden-active"). */
  storageKey?: string;
};

export type UseFilterStateReturn<T extends FilterSchema> = T extends "garden"
  ? {
      filters: GardenFilterValues;
      setVariety: (v: string | null) => void;
      setPlantCategory: (v: string | null) => void;
      setSun: (v: string | null) => void;
      setSpacing: (v: string | null) => void;
      setGermination: (v: string | null) => void;
      setMaturity: (v: string | null) => void;
      setTags: (v: string[] | ((prev: string[]) => string[])) => void;
      toggleTagFilter: (tag: string) => void;
      setPlantMonth: (v: number | null) => void;
      setPlantNames: (v: string[] | ((prev: string[]) => string[])) => void;
      clearAllFilters: () => void;
      hasActiveFilters: boolean;
      filterCount: number;
      saveAsDefault: (extended?: { sortBy?: string; sortDir?: "asc" | "desc" }) => void;
      clearDefault: () => void;
      hasDefault: boolean;
      loadedSort: { sortBy: string; sortDir: "asc" | "desc" } | null;
    }
  : {
      filters: VaultFilterValues;
      setVariety: (v: string | null) => void;
      setPlantCategory: (v: string | null) => void;
      setSun: (v: string | null) => void;
      setSpacing: (v: string | null) => void;
      setGermination: (v: string | null) => void;
      setMaturity: (v: string | null) => void;
      setTags: (v: string[] | ((prev: string[]) => string[])) => void;
      setVendor: (v: string | null) => void;
      setPacketCount: (v: string | null) => void;
      setMethod: (v: string | null) => void;
      toggleTagFilter: (tag: string) => void;
      setPlantMonth: (v: number | null) => void;
      setPlantNames: (v: string[] | ((prev: string[]) => string[])) => void;
      toggleInventory: (key: InventoryToggleKey) => void;
      clearAllFilters: () => void;
      hasActiveFilters: boolean;
      filterCount: number;
      saveAsDefault: (extended?: { sortBy?: string; sortDirection?: "asc" | "desc" }) => void;
      clearDefault: () => void;
      hasDefault: boolean;
      loadedSort: { sortBy: string; sortDir: "asc" | "desc" } | null;
    };

export function useFilterState<T extends FilterSchema>(
  options: UseFilterStateOptions<T>
): UseFilterStateReturn<T> {
  const { schema, onClear, isFilterActive, storageKey } = options;
  const empty = schema === "garden" ? EMPTY_GARDEN : EMPTY_VAULT;

  const [filters, setFilters] = useState<GardenFilterValues | VaultFilterValues>(() => {
    if (storageKey) {
      const loaded = loadFilterDefault<unknown>(storageKey);
      const normalized =
        schema === "garden"
          ? normalizeGardenLoaded(loaded)
          : normalizeVaultLoaded(loaded);
      if (normalized) return normalized;
    }
    return schema === "garden" ? { ...EMPTY_GARDEN } : { ...EMPTY_VAULT };
  });

  const [defaultSaved, setDefaultSaved] = useState(() =>
    storageKey ? hasFilterDefault(storageKey) : false
  );

  const clearAllFilters = useCallback(() => {
    setFilters({ ...empty } as GardenFilterValues & VaultFilterValues);
    onClear?.();
  }, [empty, onClear]);

  const saveAsDefault = useCallback((extended?: { sortBy?: string; sortDir?: "asc" | "desc" }) => {
    if (storageKey) {
      saveFilterDefault(storageKey, { ...filters, ...extended });
      setDefaultSaved(true);
    }
  }, [storageKey, filters]);

  const clearDefault = useCallback(() => {
    if (storageKey) {
      clearFilterDefault(storageKey);
      setDefaultSaved(false);
    }
  }, [storageKey]);

  const toggleTagFilter = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  }, []);

  const setVariety = useCallback((v: string | null) => {
    setFilters((prev) => ({ ...prev, variety: v }));
  }, []);
  const setPlantCategory = useCallback((v: string | null) => {
    setFilters((prev) => ({ ...prev, plantCategory: v }));
  }, []);
  const setSun = useCallback((v: string | null) => {
    setFilters((prev) => ({ ...prev, sun: v }));
  }, []);
  const setSpacing = useCallback((v: string | null) => {
    setFilters((prev) => ({ ...prev, spacing: v }));
  }, []);
  const setGermination = useCallback((v: string | null) => {
    setFilters((prev) => ({ ...prev, germination: v }));
  }, []);
  const setMaturity = useCallback((v: string | null) => {
    setFilters((prev) => ({ ...prev, maturity: v }));
  }, []);
  const setTags = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    setFilters((prev) => ({
      ...prev,
      tags: typeof v === "function" ? v(prev.tags) : v,
    }));
  }, []);
  const setPlantMonth = useCallback((v: number | null) => {
    setFilters((prev) => ({ ...prev, plantMonth: v }));
  }, []);
  const setPlantNames = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    setFilters((prev) => ({
      ...prev,
      plantNames: typeof v === "function" ? v(prev.plantNames) : v,
    }));
  }, []);

  const setVendor = useCallback((v: string | null) => {
    setFilters((prev) => (schema === "vault" ? { ...prev, vendor: v } : prev));
  }, [schema]);
  const setPacketCount = useCallback((v: string | null) => {
    setFilters((prev) => (schema === "vault" ? { ...prev, packetCount: v } : prev));
  }, [schema]);
  const setMethod = useCallback((v: string | null) => {
    setFilters((prev) => (schema === "vault" ? { ...prev, method: v } : prev));
  }, [schema]);
  const toggleInventory = useCallback((key: InventoryToggleKey) => {
    setFilters((prev) => {
      if (schema !== "vault") return prev;
      const vault = prev as VaultFilterValues;
      const field = key === "growing" ? "invGrowing" : key === "hasPackets" ? "invHasPackets" : key === "prevGrown" ? "invPrevGrown" : "invPrevOwned";
      return { ...vault, [field]: !vault[field] };
    });
  }, [schema]);

  const baseHasActive = schema === "garden"
    ? hasActiveGardenFilters(filters as GardenFilterValues)
    : hasActiveVaultFilters(filters as VaultFilterValues);
  const hasActiveFilters = baseHasActive || (isFilterActive?.() ?? false);

  const baseCount = schema === "garden"
    ? countActiveGardenFilters(filters as GardenFilterValues)
    : countActiveVaultFilters(filters as VaultFilterValues);
  const filterCount = baseCount + (isFilterActive?.() ? 1 : 0);

  const hasDefault = storageKey ? defaultSaved : false;

  const [loadedSort] = useState<{ sortBy: string; sortDir: "asc" | "desc" } | null>(() =>
    storageKey && (schema === "garden" || schema === "vault") ? extractSortFromLoaded(loadFilterDefault(storageKey)) : null
  );

  return {
    filters: filters as T extends "garden" ? GardenFilterValues : VaultFilterValues,
    setVariety,
    setPlantCategory,
    setSun,
    setSpacing,
    setGermination,
    setMaturity,
    setTags,
    setPlantMonth,
    setPlantNames,
    ...(schema === "vault" ? { setVendor, setPacketCount, setMethod, toggleInventory } : {}),
    toggleTagFilter,
    clearAllFilters,
    hasActiveFilters,
    filterCount,
    saveAsDefault,
    clearDefault,
    hasDefault,
    ...(schema === "garden" || schema === "vault" ? { loadedSort: loadedSort ?? null } : {}),
  } as UseFilterStateReturn<T>;
}
