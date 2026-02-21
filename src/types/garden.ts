// ============================================================================
// Garden Types – canonical interfaces for all Supabase tables
// ============================================================================

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export type TaskType =
  | "sow"
  | "harvest"
  | "start_seed"
  | "transplant"
  | "direct_sow"
  | "maintenance"
  | "fertilize"
  | "prune"
  | "general";

export interface Task {
  id: string;
  plant_profile_id?: string | null;
  plant_variety_id: string | null;
  category: TaskType;
  due_date: string; // ISO date
  completed_at: string | null;
  created_at: string;
  grow_instance_id: string | null;
  title?: string | null;
  care_schedule_id?: string | null;
  supply_profile_id?: string | null;
  deleted_at?: string | null;
}

// ---------------------------------------------------------------------------
// Grow Instances
// ---------------------------------------------------------------------------
export type GrowInstanceStatus =
  | "pending"
  | "growing"
  | "harvested"
  | "dead"
  | "archived";

export interface GrowInstance {
  id: string;
  plant_profile_id?: string | null;
  plant_variety_id?: string | null; // legacy — column dropped from DB
  sown_date: string;
  expected_harvest_date: string | null;
  status?: GrowInstanceStatus | null;
  ended_at?: string | null;
  location?: string | null;
  end_reason?: string | null;
  seed_packet_id?: string | null;
  created_at: string;
  user_id: string;
  deleted_at?: string | null;
  sow_method?: "direct_sow" | "seed_start" | null;
  seeds_sown?: number | null;
  seeds_sprouted?: number | null;
  plant_count?: number | null;
}

// ---------------------------------------------------------------------------
// Journal Entries
// ---------------------------------------------------------------------------
export type JournalEntryType =
  | "planting"
  | "growth"
  | "harvest"
  | "note"
  | "care"
  | "pest"
  | "death"
  | "quick";

export type WeatherSnapshotData = {
  temp?: number;
  condition?: string;
  code?: number;
  icon?: string;
  wind_speed_mph?: number;
} | null;

export interface JournalEntry {
  id: string;
  plant_variety_id: string | null;
  plant_profile_id?: string | null;
  grow_instance_id: string | null;
  seed_packet_id?: string | null;
  note: string | null;
  photo_url: string | null;
  image_file_path: string | null;
  weather_snapshot?: WeatherSnapshotData;
  entry_type?: JournalEntryType | null;
  harvest_weight?: number | null;
  harvest_unit?: string | null;
  harvest_quantity?: number | null;
  created_at: string;
  user_id: string;
  supply_profile_id?: string | null;
  deleted_at?: string | null;
}

// ---------------------------------------------------------------------------
// Shopping List (unified: out-of-stock + wishlist placeholders)
// ---------------------------------------------------------------------------
export interface ShoppingListItem {
  id: string;
  user_id: string;
  /** Set when item is from vault (out of stock); null for wishlist placeholders. */
  plant_profile_id: string | null;
  plant_variety_id?: string; // legacy
  /** Set when item is a supply (running low). */
  supply_profile_id?: string | null;
  /** Wishlist: display name when plant_profile_id is null. */
  placeholder_name?: string | null;
  placeholder_variety?: string | null;
  is_purchased?: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Plant Varieties (legacy)
// ---------------------------------------------------------------------------
export interface PlantVarietyProfile {
  id: string;
  name: string;
  variety_name: string | null;
  user_id: string;
  sun?: string | null;
  water?: string | null;
  harvest?: string | null;
  vendor?: string | null;
  harvest_days?: number | null;
  days_to_germination?: string | null;
  plant_spacing?: string | null;
  inventory_count?: number | null;
  status?: string | null;
  tags?: string[] | null;
  source_url?: string | null;
  primary_image_path?: string | null;
  growing_notes?: string | null;
  growing_info_from_source?: string | null;
  plant_description?: string | null;
  pretreatment_notes?: string | null;
  scrape_status?: string | null;
  scrape_error_log?: string | null;
}

// ---------------------------------------------------------------------------
// Plant Profiles
// ---------------------------------------------------------------------------
export type PlantProfileType = "seed" | "permanent";

/** Plant > Packets: master biological identity (parent). */
export interface PlantProfile {
  id: string;
  user_id: string;
  name: string;
  variety_name: string | null;
  profile_type?: PlantProfileType;
  primary_image_path?: string | null;
  /** Hero (plant) photo path in journal-photos bucket; overrides packet for profile/vault thumb. */
  hero_image_path?: string | null;
  hero_image_url?: string | null;
  hero_image_pending?: boolean;
  sun?: string | null;
  water?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
  height?: string | null;
  tags?: string[] | null;
  status?: string | null;
  sowing_method?: string | null;
  planting_window?: string | null;
  /** Seed sowing depth (e.g. "1/4 inch"). From vendor, AI, or cache. */
  sowing_depth?: string | null;
  purchase_date?: string | null;
  /** Store-bought (no packet): vendor/seller name */
  purchase_vendor?: string | null;
  /** Store-bought (no packet): nursery or store name */
  purchase_nursery?: string | null;
  scientific_name?: string | null;
  botanical_care_notes?: Record<string, unknown> | null;
  perenual_id?: number | null;
  /** Companion plants (plant with); common names. */
  companion_plants?: string[] | null;
  /** Plants to avoid planting nearby. */
  avoid_plants?: string[] | null;
  /** Short description of the plant/variety (vendor or AI). Shown in About tab. */
  plant_description?: string | null;
  /** Detailed growing/seed-starting notes. Shown with description for full grow context. */
  growing_notes?: string | null;
  /** Source of description/notes: 'vendor' | 'ai' | 'user' for UI attribution. */
  description_source?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

// ---------------------------------------------------------------------------
// Seed Packets
// ---------------------------------------------------------------------------
/** Vendor-specific growing specs stored per packet (from import); shown in "Vendor recommendations" on profile. */
export type VendorSpecs = {
  sowing_depth?: string;
  spacing?: string;
  sun_requirement?: string;
  days_to_germination?: string;
  days_to_maturity?: string;
  plant_description?: string;
};

/** Plant > Packets: one physical packet (vendor, url, qty slider, scraped details). */
export interface SeedPacket {
  id: string;
  plant_profile_id: string;
  user_id: string;
  vendor_name?: string | null;
  purchase_url?: string | null;
  purchase_date?: string | null;
  price?: string | null;
  qty_status: number;
  scraped_details?: string | null;
  primary_image_path?: string | null;
  packet_photo_path?: string | null;
  user_notes?: string | null;
  /** Where the user stores this physical packet (e.g. box, drawer). */
  storage_location?: string | null;
  created_at?: string;
  tags?: string[] | null;
  is_archived?: boolean;
  deleted_at?: string | null;
  /** That vendor's growing recommendations (from import); shown on profile "By packet". */
  vendor_specs?: VendorSpecs | null;
  /** User's personal 1–5 rating for this packet. Null = not yet rated. */
  packet_rating?: number | null;
}

// ---------------------------------------------------------------------------
// Tag Settings
// ---------------------------------------------------------------------------
/** User-defined tag for extraction and vault (tag_settings table). */
export interface TagSetting {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// User Settings
// ---------------------------------------------------------------------------
export interface UserSettings {
  id: string;
  user_id: string;
  planting_zone?: string | null;
  last_frost_date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  location_name?: string | null;
  display_shorthand?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Care Schedules
// ---------------------------------------------------------------------------
export type CareRecurrenceType =
  | "interval"
  | "monthly"
  | "yearly"
  | "custom_dates"
  | "one_off";

export interface CareSchedule {
  id: string;
  plant_profile_id?: string | null;
  grow_instance_id?: string | null;
  /** For permanent plants: apply to these instances. Null = all. Overrides grow_instance_id when set. */
  grow_instance_ids?: string[] | null;
  user_id: string;
  title: string;
  category: string;
  recurrence_type: CareRecurrenceType;
  interval_days?: number | null;
  months?: number[] | null;
  day_of_month?: number | null;
  custom_dates?: string[] | null;
  next_due_date?: string | null;
  end_date?: string | null;
  last_completed_at?: string | null;
  is_active: boolean;
  is_template: boolean;
  notes?: string | null;
  supply_profile_id?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Supply Profiles (Shed)
// ---------------------------------------------------------------------------
export type SupplyCategory = "fertilizer" | "pesticide" | "soil_amendment" | "other";

export interface SupplyProfile {
  id: string;
  user_id: string;
  name: string;
  brand?: string | null;
  category: SupplyCategory;
  usage_instructions?: string | null;
  application_rate?: string | null;
  primary_image_path?: string | null;
  source_url?: string | null;
  npk?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  replaced_by_id?: string | null;
}

// ---------------------------------------------------------------------------
// Household Sharing
// ---------------------------------------------------------------------------
export interface Household {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string | null;
  created_at: string;
  updated_at: string;
}

export type HouseholdMemberRole = "owner" | "admin" | "member";

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: HouseholdMemberRole;
  joined_at: string;
}

export interface HouseholdEditGrant {
  id: string;
  household_id: string;
  grantor_user_id: string;
  grantee_user_id: string;
  created_at: string;
}
