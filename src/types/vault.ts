export type Volume = "full" | "partial" | "low" | "empty";

/** Packet vault status filter (Seed Vault tab). Shared so vault page doesn't import from PacketVaultView at init. */
export type PacketStatusFilter = "" | "vault" | "active" | "low_inventory" | "archived";

/** Plant Profiles grid/list status filter. In types so vault page doesn't import SeedVaultView at init (avoids zone10b chunk). */
export type StatusFilter = "" | "vault" | "active" | "low_inventory" | "archived";

/** Plant Profiles sort column. In types so vault page doesn't import SeedVaultView at init. */
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
