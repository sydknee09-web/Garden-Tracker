"use client";

import { useState, useCallback, useMemo } from "react";

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

/** Vault extends Garden with status, vendor, packetCount. */
export type VaultFilterValues = GardenFilterValues & {
  status: string;
  vendor: string | null;
  packetCount: string | null;
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
    [f.status !== "", f.vendor !== null, f.packetCount !== null].filter(Boolean).length
  );
}

function hasActiveGardenFilters(f: GardenFilterValues): boolean {
  return countActiveGardenFilters(f) > 0;
}

function hasActiveVaultFilters(f: VaultFilterValues): boolean {
  return countActiveVaultFilters(f) > 0;
}

export type UseFilterStateOptions<T extends FilterSchema> = {
  schema: T;
  /** Called after clearing filters (e.g. router.replace to clear URL params). */
  onClear?: () => void;
  /** Additional check for hasActiveFilters (e.g. sowParam from URL). */
  isFilterActive?: () => boolean;
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
      clearAllFilters: () => void;
      hasActiveFilters: boolean;
      filterCount: number;
    };

export function useFilterState<T extends FilterSchema>(
  options: UseFilterStateOptions<T>
): UseFilterStateReturn<T> {
  const { schema, onClear, isFilterActive } = options;
  const empty = schema === "garden" ? EMPTY_GARDEN : EMPTY_VAULT;

  const [filters, setFilters] = useState<GardenFilterValues | VaultFilterValues>(() =>
    schema === "garden" ? { ...EMPTY_GARDEN } : { ...EMPTY_VAULT }
  );

  const clearAllFilters = useCallback(() => {
    setFilters({ ...empty } as GardenFilterValues & VaultFilterValues);
    onClear?.();
  }, [empty, onClear]);

  const toggleTagFilter = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  }, []);

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

  return {
    filters: filters as T extends "garden" ? GardenFilterValues : VaultFilterValues,
    setCategory,
    setVariety,
    setSun,
    setSpacing,
    setGermination,
    setMaturity,
    setTags,
    ...(schema === "vault" ? { setStatus, setVendor, setPacketCount } : {}),
    toggleTagFilter,
    clearAllFilters,
    hasActiveFilters,
    filterCount,
  } as UseFilterStateReturn<T>;
}
