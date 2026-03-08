"use client";

import { useState, useCallback } from "react";
import {
  loadFilterDefault,
  saveFilterDefault,
  clearFilterDefault,
  hasFilterDefault,
} from "@/lib/filterDefaults";

/** Common filter values shared by Garden and Vault. */
export type GardenFilterValues = {
  category: string | null;
  variety: string | null;
  sun: string | null;
  spacing: string | null;
  germination: string | null;
  maturity: string | null;
  tags: string[];
};

/** Vault extends Garden with status, vendor, packetCount, seedTypes. */
export type VaultFilterValues = GardenFilterValues & {
  status: string;
  vendor: string | null;
  packetCount: string | null;
  /** Seed type categories (Vegetable, Herb, Flower, etc.) — separate from tags (F1, Heirloom, etc.). */
  seedTypes: string[];
};

export type FilterSchema = "garden" | "vault";

const EMPTY_GARDEN: GardenFilterValues = {
  category: null,
  variety: null,
  sun: null,
  spacing: null,
  germination: null,
  maturity: null,
  tags: [],
};

const EMPTY_VAULT: VaultFilterValues = {
  ...EMPTY_GARDEN,
  status: "",
  vendor: null,
  packetCount: null,
  seedTypes: [],
};

function countActiveGardenFilters(f: GardenFilterValues): number {
  return [
    f.category !== null,
    f.variety !== null,
    f.sun !== null,
    f.spacing !== null,
    f.germination !== null,
    f.maturity !== null,
    f.tags.length > 0,
  ].filter(Boolean).length;
}

function countActiveVaultFilters(f: VaultFilterValues): number {
  return (
    countActiveGardenFilters(f) +
    [f.status !== "", f.vendor !== null, f.packetCount !== null, f.seedTypes.length > 0].filter(Boolean).length
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
    category: typeof o.category === "string" ? o.category : null,
    variety: typeof o.variety === "string" ? o.variety : null,
    sun: typeof o.sun === "string" ? o.sun : null,
    spacing: typeof o.spacing === "string" ? o.spacing : null,
    germination: typeof o.germination === "string" ? o.germination : null,
    maturity: typeof o.maturity === "string" ? o.maturity : null,
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string") : [],
  };
}

function normalizeVaultLoaded(raw: unknown): VaultFilterValues | null {
  const garden = normalizeGardenLoaded(raw);
  if (!garden) return null;
  const o = raw as Record<string, unknown>;
  return {
    ...garden,
    status: typeof o.status === "string" ? o.status : "",
    vendor: typeof o.vendor === "string" ? o.vendor : null,
    packetCount: typeof o.packetCount === "string" ? o.packetCount : null,
    seedTypes: Array.isArray(o.seedTypes) ? o.seedTypes.filter((t): t is string => typeof t === "string") : [],
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
      setCategory: (v: string | null) => void;
      setVariety: (v: string | null) => void;
      setSun: (v: string | null) => void;
      setSpacing: (v: string | null) => void;
      setGermination: (v: string | null) => void;
      setMaturity: (v: string | null) => void;
      setTags: (v: string[] | ((prev: string[]) => string[])) => void;
      toggleTagFilter: (tag: string) => void;
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
      setCategory: (v: string | null) => void;
      setVariety: (v: string | null) => void;
      setSun: (v: string | null) => void;
      setSpacing: (v: string | null) => void;
      setGermination: (v: string | null) => void;
      setMaturity: (v: string | null) => void;
      setTags: (v: string[] | ((prev: string[]) => string[])) => void;
      setStatus: (v: string) => void;
      setVendor: (v: string | null) => void;
      setPacketCount: (v: string | null) => void;
      toggleTagFilter: (tag: string) => void;
      toggleSeedTypeFilter: (seedType: string) => void;
      setSeedTypes: (v: string[] | ((prev: string[]) => string[])) => void;
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

  const toggleSeedTypeFilter = useCallback((seedType: string) => {
    setFilters((prev) => {
      if (schema !== "vault") return prev;
      const vault = prev as VaultFilterValues;
      const next = vault.seedTypes.includes(seedType)
        ? vault.seedTypes.filter((t) => t !== seedType)
        : [...vault.seedTypes, seedType];
      return { ...prev, seedTypes: next };
    });
  }, [schema]);

  const setSeedTypes = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    setFilters((prev) => {
      if (schema !== "vault") return prev;
      const vault = prev as VaultFilterValues;
      const next = typeof v === "function" ? v(vault.seedTypes) : v;
      return { ...prev, seedTypes: next };
    });
  }, [schema]);

  const setCategory = useCallback((v: string | null) => {
    setFilters((prev) => ({ ...prev, category: v }));
  }, []);
  const setVariety = useCallback((v: string | null) => {
    setFilters((prev) => ({ ...prev, variety: v }));
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

  const setStatus = useCallback((v: string) => {
    setFilters((prev) => (schema === "vault" ? { ...prev, status: v } : prev));
  }, [schema]);
  const setVendor = useCallback((v: string | null) => {
    setFilters((prev) => (schema === "vault" ? { ...prev, vendor: v } : prev));
  }, [schema]);
  const setPacketCount = useCallback((v: string | null) => {
    setFilters((prev) => (schema === "vault" ? { ...prev, packetCount: v } : prev));
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
    setCategory,
    setVariety,
    setSun,
    setSpacing,
    setGermination,
    setMaturity,
    setTags,
    ...(schema === "vault" ? { setStatus, setVendor, setPacketCount, toggleSeedTypeFilter, setSeedTypes } : {}),
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
