export type Volume = "full" | "partial" | "low" | "empty";

export interface PlantVariety {
  id: string;
  name: string;
  variety: string | null;
}

export interface SeedStockRow {
  id: string;
  plant_variety_id: string;
  volume: Volume;
  plant_varieties: Pick<PlantVariety, "name" | "variety"> | null;
}

/** Legacy flat display (seed_stocks + plant_varieties). */
export type SeedStockDisplay = {
  id: string;
  plant_variety_id: string;
  name: string;
  variety: string;
  volume: Volume;
  inventory_count?: number | null;
  status?: string | null;
  harvest_days?: number | null;
  tags?: string[] | null;
  source_url?: string | null;
};

/** Plant > Packets: one profile with packet count for vault list. */
export type PlantProfileDisplay = {
  id: string;
  name: string;
  variety: string;
  status?: string | null;
  harvest_days?: number | null;
  tags?: string[] | null;
  primary_image_path?: string | null;
  packet_count: number;
};
