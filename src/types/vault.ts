export type Volume = "full" | "partial" | "low" | "empty";

/** Library sort column. In types so vault page doesn't import SeedVaultView at init. */
export type VaultSortBy = "purchase_date" | "name" | "date_added" | "variety" | "packet_count";

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
