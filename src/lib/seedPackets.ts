/**
 * Select columns for seed_packets used on the plant profile page (vault/[id]).
 * Must include storage_location (requires migration 20250222000000 or 20250230000000).
 */
export const SEED_PACKET_PROFILE_SELECT =
  "id, plant_profile_id, user_id, vendor_name, purchase_url, purchase_date, price, qty_status, scraped_details, primary_image_path, packet_photo_path, created_at, user_notes, storage_location, tags, vendor_specs, is_archived, packet_rating";
