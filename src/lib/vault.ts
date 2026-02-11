import type { SeedStockDisplay, Volume } from "@/types/vault";

/** Raw row shape from Supabase seed_stocks select with plant_varieties join. */
export type SeedStockRowRaw = {
  id?: string | null;
  plant_variety_id?: string | null;
  volume?: string | null;
  plant_varieties?: {
    name?: string | null;
    variety_name?: string | null;
    inventory_count?: number | null;
    status?: string | null;
    harvest_days?: number | null;
    tags?: string[] | null;
    source_url?: string | null;
  } | null;
  plant_variety?: {
    name?: string | null;
    variety_name?: string | null;
    inventory_count?: number | null;
    status?: string | null;
    harvest_days?: number | null;
    tags?: string[] | null;
    source_url?: string | null;
  } | null;
};

const VALID_VOLUMES: Volume[] = ["full", "partial", "low", "empty"];

function toVolume(value: unknown): Volume {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (VALID_VOLUMES.includes(lower as Volume)) return lower as Volume;
  }
  return "full";
}

/**
 * Maps a raw Supabase seed_stocks row (with joined plant_varieties or plant_variety)
 * to SeedStockDisplay. Defensive against missing or malformed data.
 */
export function normalizeSeedStockRow(row: SeedStockRowRaw | null | undefined): SeedStockDisplay {
  if (row == null) {
    return {
      id: "",
      plant_variety_id: "",
      name: "Unknown",
      variety: "—",
      volume: "full",
      inventory_count: null,
      status: null,
      harvest_days: null,
      tags: null,
      source_url: null,
    };
  }
  const pv = row.plant_varieties ?? row.plant_variety;
  const vol = toVolume(row.volume);
  return {
    id: String(row.id ?? ""),
    plant_variety_id: String(row.plant_variety_id ?? ""),
    name: pv?.name != null && pv.name !== "" ? String(pv.name) : "Unknown",
    variety: pv?.variety_name != null && pv.variety_name !== "" ? String(pv.variety_name) : "—",
    volume: vol,
    inventory_count: pv?.inventory_count ?? null,
    status: pv?.status != null ? String(pv.status) : null,
    harvest_days: typeof pv?.harvest_days === "number" ? pv.harvest_days : null,
    tags: Array.isArray(pv?.tags) ? pv.tags : null,
    source_url: pv?.source_url != null ? String(pv.source_url) : null,
  };
}

/**
 * Maps an array of raw Supabase seed_stocks rows to SeedStockDisplay[].
 * Skips null/undefined entries; never throws.
 */
export function normalizeSeedStockRows(rows: (SeedStockRowRaw | null | undefined)[] | null | undefined): SeedStockDisplay[] {
  if (rows == null || !Array.isArray(rows)) return [];
  return rows.map((r) => normalizeSeedStockRow(r));
}
