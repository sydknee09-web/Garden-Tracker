// ============================================================================
// Garden Types – canonical interfaces for all Supabase tables
// ============================================================================

// ---------------------------------------------------------------------------
// Refine / Filter Chips (Garden, Vault)
// ---------------------------------------------------------------------------
/** Chip counts for refine-by filters. Used by Active Garden, My Plants, and Vault. */
export type RefineChips = {
  variety: { value: string; count: number }[];
  sun: { value: string; count: number }[];
  spacing: { value: string; count: number }[];
  germination: { value: string; count: number }[];
  maturity: { value: string; count: number }[];
  tags: string[];
};

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
export type GrowInstanceStatus = "growing" | "archived";

/**
 * Cover-photo state machine for a growing instance (Syd lock 2026-06-11).
 * auto = most-recent non-receipt journal photo (default; silent profile-hero fallback);
 * pinned_journal = user pinned a specific journal photo (cover_photo_journal_entry_id set);
 * pinned_profile_hero = user pinned the species hero — journaling new photos never overrides.
 */
export type CoverPhotoMode = "auto" | "pinned_journal" | "pinned_profile_hero";

export interface GrowInstance {
  id: string;
  plant_profile_id?: string | null;
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
  /** Date seeds sprouted; set when logging germination. Used for days_to_germinate display. */
  sprout_date?: string | null;
  plant_count?: number | null;
  /** True = show in My Plants. False/null = show in Active Garden. Set when adding from Add permanent plant flow. */
  is_permanent_planting?: boolean | null;
  /** What you paid for the plant (e.g. $12.99). Separate from seed packet price. */
  purchase_price?: string | null;
  /** Number of plants purchased. May equal initial plant_count. */
  purchase_quantity?: number | null;
  /** Store or nursery where this planting was purchased (e.g. Home Depot, Briggs Tree Nursery). */
  vendor?: string | null;
  /** User-defined organization labels assigned to this planting; populated by joins via plant_groups. Optional — only present when the query selected groups. */
  groups?: Group[];
  /** Cover-photo mode; null/undefined reads as 'auto' (pre-migration rows + narrow selects). */
  cover_photo_mode?: CoverPhotoMode | null;
  /** Journal entry pinned as cover; only meaningful when cover_photo_mode = 'pinned_journal'. */
  cover_photo_journal_entry_id?: string | null;
}

// ---------------------------------------------------------------------------
// Groups (user-defined plant organization labels)
// ---------------------------------------------------------------------------

/** User-defined organization label for plantings (e.g. "Patio", "Bedroom"). Per-user; no household sharing in v1. M-N to grow_instances via plant_groups. */
export interface Group {
  id: string;
  user_id: string;
  name: string;
  /** User-defined ordering; lower = leftward. Nullable; new groups default null and sort to end via "position NULLS LAST, created_at ASC". */
  position?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/** M-N join row: a single (grow_instance, group) assignment. Denormalized user_id for RLS. Hard-deleted on unassign. */
export interface PlantGroup {
  id: string;
  grow_instance_id: string;
  group_id: string;
  user_id: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Journal Entries
// ---------------------------------------------------------------------------
export type JournalEntryType =
  | "planting"
  | "vault_add"
  | "growth"
  | "harvest"
  | "note"
  | "care"
  | "pest"
  | "death"
  | "quick"
  | "prune"
  | "cold_stratify";

export type WeatherSnapshotData = {
  temp?: number;
  condition?: string;
  code?: number;
  icon?: string;
  wind_speed_mph?: number;
} | null;

export interface JournalEntry {
  id: string;
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
// Plant Profiles (Vault Library)
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
  /** Typical mature height (e.g. "3-4 ft"). From Magic Fill or manual. */
  mature_height?: string | null;
  /** Typical mature spread/width (e.g. "2 ft"). From Magic Fill or manual. */
  mature_width?: string | null;
  tags?: string[] | null;
  status?: string | null;
  sowing_method?: string | null;
  planting_window?: string | null;
  /** USDA zone the AI used when generating planting_window. NULL = pre-Phase-2 or zone-agnostic. */
  planting_window_zone?: string | null;
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
  /** How to propagate (cuttings, division, layering). For perennials. */
  propagation_notes?: string | null;
  /** How to harvest and save seeds. For seed-grown varieties. */
  seed_saving_notes?: string | null;
  /** One-sentence AI-generated caveat about seed-propagation suitability. NULL = standard seed-grown variety, no caveat needed. */
  seed_propagation_context?: string | null;
  /** Source of description/notes: 'vendor' | 'ai' | 'user' for UI attribution. */
  description_source?: string | null;
  // ── Sprint 4 enrichment fields (migration 20260610120000) — all AI-fillable ──
  /** Botanical lifecycle: Annual | Biennial | Perennial. Supersedes profile_type (kept derived). */
  lifecycle?: string | null;
  /** Structural type: Tree | Shrub | Vine | Herbaceous | Grass | Groundcover | Bulb | Tuber. */
  growth_form?: string | null;
  /** Category: Flower | Fruit | Vegetable | Herb | Ornamental | Houseplant. */
  plant_category?: string | null;
  /** Spreading pattern: Vining | Bushing | Trailing | Mounding | Upright | Spreading | Climbing | Clumping. */
  growth_habit?: string | null;
  /** Structured propagation methods: Seed | Cutting | Division | Layering | Grafting | Bulb-Tuber division | Spore | Runner. */
  propagation_method?: string[] | null;
  soil_preference?: string | null;
  disease_susceptibility?: string[] | null;
  pollination_requirements?: string | null;
  toxicity?: string | null;
  deer_rabbit_resistance?: string | null;
  wildlife_value?: string | null;
  invasiveness?: string | null;
  native_origin?: string | null;
  drought_salt_tolerance?: string | null;
  synonyms?: string[] | null;
  uses?: string[] | null;
  special_features?: string[] | null;
  /** Pill tier for watering; pairs with water_detail. */
  water_summary?: string | null;
  water_detail?: string | null;
  /** Pill tier for sun/light; pairs with sun_detail. */
  sun_summary?: string | null;
  sun_detail?: string | null;
  harvest_season?: string[] | null;
  spring_indoor_window?: string | null;
  spring_outdoor_window?: string | null;
  summer_window?: string | null;
  fall_outdoor_window?: string | null;
  /** Transplant depth (inches), distinct from sowing_depth (seed depth). */
  planting_depth?: number | null;
  family?: string | null;
  genus?: string | null;
  species?: string | null;
  // ── AI Fill overhaul Ship 2 (migration 20260611150000) ──
  /** Per-field AI provenance map { column: 'variety' | 'cultivar' | 'species' }. Absent entry = user-entered / legacy. */
  field_provenance?: Record<string, string> | null;
  /** Generation of AI enrichment (migration 20260613130000). 0 = legacy/needs-re-enrichment; CURRENT_AI_FILL_VERSION = current. */
  enrichment_version?: number | null;
  /** Rich plain-language When-to-Plant narrative ("Cannas are a spring/summer plant…"). */
  when_to_plant_description?: string | null;
  /** Seasons appropriate for planting: Spring | Summer | Fall | Winter. */
  planting_seasons_tags?: string[] | null;
  /** Months 1-12 for planting (zone-biased when the AI ran with a zone). */
  optimal_planting_months_array?: number[] | null;
  /** Weeks BEFORE last frost to start indoors. NULL = not applicable. */
  indoor_start_weeks_before_frost?: number | null;
  /** Weeks AFTER last frost to plant/sow outside. 0 = at last frost. NULL = not applicable. */
  outdoor_plant_weeks_after_frost?: number | null;
  /** Coldest USDA hardiness zone (1-13) the plant survives outdoors. Zone-AGNOSTIC stored fact; drives the render-time viability banner. */
  hardiness_zone_min?: number | null;
  /** Warmest USDA hardiness zone (1-13) the plant grows well in. Zone-AGNOSTIC stored fact. */
  hardiness_zone_max?: number | null;
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
// Care Schedule Suggestions (AI-generated, pending approve/reject)
// ---------------------------------------------------------------------------
export interface CareScheduleSuggestion {
  id: string;
  plant_profile_id: string;
  user_id: string;
  title: string;
  category: string;
  recurrence_type: string;
  interval_days?: number | null;
  notes?: string | null;
  created_at?: string;
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
  /** Self-FK: template this row was cloned from. NULL = standalone schedule, profile-level template, or pre-C1 clone. */
  source_template_id?: string | null;
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
  /** Product size (e.g. "1", "2.5"). */
  size?: string | null;
  /** Unit of measure (e.g. "gal", "qt", "oz"). */
  size_uom?: string | null;
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

export type PageKey = "seed_vault" | "plant_vault" | "garden" | "journal" | "shed" | "shopping_list";

export type PageAccessLevel = "view" | "edit" | "block";

export interface HouseholdPagePermission {
  id: string;
  household_id: string;
  grantor_user_id: string;
  grantee_user_id: string;
  page: PageKey;
  access_level: PageAccessLevel;
  created_at: string;
}

/** Human-readable labels for page keys (for Settings UI) */
export const PAGE_LABELS: Record<PageKey, string> = {
  seed_vault: "Seed vault",
  plant_vault: "Plant vault",
  garden: "My garden & Permanent plants",
  journal: "Journal",
  shed: "Shed",
  shopping_list: "Shopping list",
};
