# Seed Vault -- Definitive Testing Checklist

Use this checklist to confirm every feature in the 10-phase blueprint is functioning properly. Work through each phase sequentially. Mark items with `[x]` as you verify them.

---

## Phase 1: Database & Schema Foundation

### Tables & Columns
- [ ] `user_settings` table exists in Supabase with columns: `id`, `user_id`, `planting_zone`, `last_frost_date`, `latitude`, `longitude`, `timezone`, `location_name`
- [ ] `care_schedules` table exists with columns: `id`, `plant_profile_id`, `grow_instance_id`, `user_id`, `title`, `category`, `recurrence_type`, `interval_days`, `months`, `day_of_month`, `custom_dates`, `next_due_date`, `last_completed_at`, `is_active`, `is_template`, `notes`
- [ ] `plant_profiles` has `profile_type` column (default `'seed'`) and `deleted_at` column
- [ ] `journal_entries` has `entry_type`, `harvest_weight`, `harvest_unit`, `harvest_quantity` columns
- [ ] `grow_instances` has `location`, `end_reason`, `seed_packet_id` columns and status allows `'dead'`
- [ ] `seed_packets` has `packet_photo_path` and `deleted_at` columns
- [ ] `tasks` has `care_schedule_id` and `deleted_at` columns

### Shared Utilities
- [ ] `src/lib/compressImage.ts` exists and exports `compressImage()`
- [ ] Uploading any image (journal, hero, packet) goes through compression -- verify file size < 1MB in Network tab

### TypeScript Types
- [ ] `src/types/garden.ts` has `UserSettings`, `CareSchedule`, and updated `PlantProfile`, `JournalEntry`, `GrowInstance`, `SeedPacket`, `Task` interfaces

---

## Phase 2: Settings Page + Zone/Weather/Export

### Settings Layout
- [ ] Navigate to `/settings` -- page loads without errors
- [ ] Settings grouped into labeled sections: "My Garden", "Data & Tools", "Garden Brain", "Account"
- [ ] Each section is in a clearly styled card

### My Garden Section
- [ ] Planting Zone input accepts a zone value (e.g., "10b")
- [ ] Last Frost Date picker is present and functional
- [ ] Location shows lat/lng fields and a location name
- [ ] "Use My Location" button prompts browser geolocation and fills lat/lng + location name
- [ ] Saving settings persists to `user_settings` table (refresh page to verify)

### Dynamic Weather
- [ ] Dashboard (`/`) shows weather using coordinates from `user_settings` (not hardcoded Vista, CA)
- [ ] If no user_settings exist, falls back gracefully (default coords or no weather)

### Frost Alerts
- [ ] If 3-day forecast includes temps <= 32F and user has active plantings, an amber frost alert banner appears on dashboard
- [ ] Banner does NOT appear if no active plantings or temps are above freezing

### Data Export
- [ ] "Export My Data" button in Settings triggers download
- [ ] Downloaded file contains JSON data for profiles, packets, journal entries, tasks

### Trash Section
- [ ] "Trash" section shows soft-deleted items (if any)
- [ ] "Restore" button on a trashed item removes `deleted_at` and item reappears in vault
- [ ] "Permanent Delete" actually removes the row

---

## Phase 3: Plant Profile Page Redesign

### Navigation
- [ ] Click any plant in the vault grid/list -- navigates to `/vault/{id}`
- [ ] "Back to Vault" link works

### Header
- [ ] Shows: Plant Name -- Variety Name, Status Badge
- [ ] "Plan" button opens a date picker modal for creating a sow task
- [ ] "Plant" button navigates to `/vault/plant?ids={id}`
- [ ] "Edit" (pencil) button opens the edit modal
- [ ] "Delete" (trash) button shows confirmation modal with soft delete

### Hero Image
- [ ] Hero image displays using fallback chain: hero_image_url > hero_image_path > journal photo > packet image > sprout emoji
- [ ] "Change photo" button opens Set Photo modal with upload, stock photo, packet photos, and growth gallery options
- [ ] "Find Stock Photo" button triggers Gemini hero image search

### Quick Stats Bar
- [ ] Shows 3 cards: Packets count, Plantings count, Yield total
- [ ] Yield aggregates harvest entries by unit (e.g., "12 lbs, 3 bunches")

### Tabs (Seed Profiles)
- [ ] Four tabs visible: About, Packets, Plantings, Journal
- [ ] Tab switching works correctly, content updates

### About Tab
- [ ] "How to Grow" card with grouped sections: Planting, Growing, Harvest
- [ ] Planting section shows: Sowing Method, Planting Window, Spacing, Sowing Depth
- [ ] Growing section shows: Sun, Water, Germination Days
- [ ] Harvest section shows: Days to Maturity
- [ ] Tags displayed as badges
- [ ] **Care Templates section visible for seed profiles** -- shows CareScheduleManager
- [ ] Adding a care template (e.g., "Fertilize every 14 days") saves to `care_schedules` with `is_template: true`
- [ ] Growing Notes section displays if notes exist
- [ ] Source URL section shows vendor link if available
- [ ] Growth Gallery shows thumbnail strip of journal photos

### Packets Tab
- [ ] Lists all seed packets for this profile
- [ ] Each packet shows: vendor name, purchase date, qty slider, packet image
- [ ] Adjusting qty slider updates `qty_status` in database
- [ ] **Setting qty to 0 auto-archives the packet** (`is_archived: true`)
- [ ] **Raising qty above 0 un-archives** (`is_archived: false`)
- [ ] **When all packets are archived/empty, profile status becomes `out_of_stock`** and item added to shopping list
- [ ] Expanding a packet shows: original details, purchase link, linked journal entries
- [ ] Delete button soft-deletes the packet

### Plantings Tab
- [ ] Shows all grow instances for this profile
- [ ] Each shows: status badge, location, sown date, end reason
- [ ] Harvest button appears on "growing" instances
- [ ] Harvest count shown per instance
- [ ] Journal entries expandable under each planting

### Journal Tab
- [ ] Shows all journal entries for this profile, newest first
- [ ] Entry type badges displayed (planting, harvest, care, pest, death, etc.)
- [ ] Weather snapshot shown when available
- [ ] Photos displayed inline

### Edit Modal
- [ ] Opens pre-filled with current values
- [ ] Fields: Plant Type, Variety Name, Sun, Water, Spacing, Germination, Days to Maturity, Sowing Method, Planting Window, Status, Purchase Date, Growing Notes
- [ ] Saving updates the profile and refreshes the page

---

## Phase 4: Import Resilience + Image Enhancement

### 4a. Link Import Progressive Saving
- [ ] Navigate to `/vault/import` and paste 2+ seed vendor URLs
- [ ] Each successfully processed item saves to `localStorage` as it completes (check DevTools > Application > Local Storage)
- [ ] If you close the tab mid-import and reopen, completed items are recoverable
- [ ] "Stop & Review" button stops processing and navigates to review with completed items
- [ ] Failed items show red X with error message
- [ ] "Retry Failed" button re-processes only failed items
- [ ] Individual retry per failed item

### 4b. Review Page Persistence
- [ ] After import, navigate to `/vault/review-import`
- [ ] Close the tab, reopen -- review data persists (uses localStorage, not sessionStorage)
- [ ] Vault page shows "You have N items pending review" banner if unfinished review data exists
- [ ] "Save All to Vault" clears the review data

### 4c. Photo Import
- [ ] Open "Photo Import" (camera button on vault page or BatchAddSeed)
- [ ] Take a photo or upload a packet image
- [ ] Gemini extracts plant type, variety, and vendor
- [ ] Packet photo saved to `seed-packets` bucket as reference
- [ ] Hero image search happens separately for the actual plant

### 4d. Order Confirmation Scanning
- [ ] In the Photo Import modal, "Scan Order Confirmation" button is visible
- [ ] Upload a screenshot of a seed order confirmation/receipt
- [ ] Gemini extracts multiple line items from the order
- [ ] Items appear in the review-import page with vendor, plant type, and variety pre-filled
- [ ] Each item can be edited before saving to vault

---

## Phase 5: Seed Packet Inventory + New Views

### 5a. completeSowTask Fix
- [ ] On the Calendar page, mark a Sow task as complete
- [ ] Packet Picker Modal appears (or auto-selects oldest packet)
- [ ] Packet `qty_status` is decremented (not the whole row deleted)
- [ ] If qty reaches 0, packet is archived (`is_archived: true`)
- [ ] `seed_packet_id` saved on the resulting grow instance
- [ ] When all packets are archived, profile set to `out_of_stock` + added to shopping list

### 5b. Packet Picker Modal
- [ ] Modal shows all non-archived packets for the profile
- [ ] Oldest packet selected by default (FIFO)
- [ ] Multi-select checkboxes for choosing multiple packets
- [ ] Per-packet "% to use" slider
- [ ] Summary line: "Using 50% of Packet 1 + 100% of Packet 2"

### 5c. Profile Page Auto-Archive (verified in Phase 3 Packets Tab above)

### 5d. Vault Health Indicators
- [ ] On the Vault page (grid view), each card shows a colored dot:
  - Green dot = 2+ packets in stock
  - Amber dot = 1 packet remaining
  - Red dot = 0 packets / out of stock
- [ ] "Out of Stock" badge also appears for 0-packet profiles

### 5e. All My Packets Page
- [ ] Navigate to `/vault/packets`
- [ ] Shows every seed packet across all profiles
- [ ] Sortable columns: variety, vendor, purchase date, qty, status
- [ ] Toggle to show/hide archived packets
- [ ] Summary stats visible

### 5f. Planting History Page
- [ ] Navigate to `/vault/history`
- [ ] Shows every grow instance ever created
- [ ] Columns: variety, sown date, location, status, packet used, harvest count, end reason
- [ ] Click variety name to navigate to the plant profile

---

## Phase 6: Plan/Plant Workflow + Batch Management + Recurring Care

### 6a. Location Prompt
- [ ] On the Plant page (`/vault/plant?ids=...`), a "Location" text input is visible
- [ ] Entering a location (e.g., "Raised Bed #2") saves to `grow_instances.location`
- [ ] Location appears on the Active Garden cards and in Planting History

### 6b. End Batch (Mark as Dead)
- [ ] On Active Garden, each growing batch has an "End Crop" or "End Batch" button
- [ ] Modal shows reason selector: Season Ended / Plant Died / Harvested All
- [ ] Optional note field
- [ ] Selecting "Plant Died" sets `status: 'dead'` and creates journal entry with `entry_type: 'death'`

### 6c. Bulk Journal Entries
- [ ] Active Garden has a batch select mode (checkboxes)
- [ ] Select multiple batches, floating action bar shows "Add Note to Selected (N)"
- [ ] One note/photo applies to all selected batches
- [ ] All created entries have `entry_type: 'note'`

### 6d. Quick-Tap Actions
- [ ] Each Active Garden card has Water/Fertilize/Spray tap icons
- [ ] One tap creates an instant journal entry with weather snapshot
- [ ] Toast confirmation appears
- [ ] Entry has `entry_type: 'quick'`

### 6e. Recurring Care Schedules
- [ ] On a seed profile's About tab, "Care Templates" section allows adding recurring tasks
- [ ] Add "Fertilize every 2 weeks" -- saved as `care_schedule` with `is_template: true`
- [ ] When you Plant this profile, templates auto-copy to the new grow instance (`is_template: false`, `grow_instance_id` set)
- [ ] `generateCareTasks()` runs on dashboard/Active Garden load and creates tasks from due schedules
- [ ] Completing a care task advances `next_due_date` and creates a care journal entry

### 6f. Entry Type on All Journal Writes
- [ ] **Manual journal entry** from Journal page saves with `entry_type: 'note'`
- [ ] **Plant page** journal entry saves with `entry_type: 'planting'`
- [ ] **Log Growth** from Active Garden saves with `entry_type: 'growth'`
- [ ] **Harvest** saves with `entry_type: 'harvest'`
- [ ] **Quick-tap** saves with `entry_type: 'quick'`
- [ ] **End batch (death)** saves with `entry_type: 'death'`
- [ ] **completeSowTask** saves with `entry_type: 'planting'`

### 6g. Plan/Plant Buttons
- [ ] "Plan" on profile detail opens inline date picker, creates a sow task
- [ ] "Plant" navigates to `/vault/plant?ids={id}`

---

## Phase 7: Journal and Harvest Enhancements

### 7a. Harvest Modal
- [ ] Click "Harvest" on an active grow instance
- [ ] Modal shows: weight input, quantity input, unit dropdown (lbs, oz, kg, count, bunches)
- [ ] Optional photo capture with compression
- [ ] Optional note field
- [ ] Saving creates journal entry with `entry_type: 'harvest'`, `harvest_weight`, `harvest_unit`, `harvest_quantity`

### 7b. Total Yield on Profile
- [ ] Profile page Quick Stats shows aggregated yield (e.g., "12 lbs, 3 bunches")
- [ ] Yield calculated from all harvest journal entries for this profile

### 7c. Plantings Tab (verified in Phase 3 above)
- [ ] Each planting shows: sown date, location, status, packet used, harvest count, end reason
- [ ] Journal entries expandable under each planting

### 7d. Journal Timeline View
- [ ] Navigate to `/journal`
- [ ] Switch to "Timeline" view mode
- [ ] Entries grouped by plant, chronological within each group
- [ ] Entry type badges, photo thumbnails, and weather displayed
- [ ] Table and Grid views also work

---

## Phase 8: Permanent Plant Profiles

### 8a. My Plants Tab on Vault
- [ ] Vault page has a "My Plants" tab/view
- [ ] Shows only `profile_type = 'permanent'` profiles
- [ ] Simplified "Add Plant" form (name, variety, notes, photo)
- [ ] Cards show: hero image, name, next care due

### 8b. Care Schedule Management (Permanent Plants)
- [ ] Open a permanent plant profile
- [ ] "Care" tab replaces "Packets" tab
- [ ] Add/edit/delete recurring care schedules
- [ ] Recurrence types: interval (every N days), monthly, yearly, one-off
- [ ] Overdue schedules highlighted

### 8c. Permanent Plant Profile Detail
- [ ] Tabs: About, Care, Journal
- [ ] About tab shows overview info
- [ ] Care tab shows CareScheduleManager
- [ ] Journal tab shows full history

### 8d. Dashboard Plant Care Section
- [ ] Dashboard shows "Plant Care" section
- [ ] Lists care tasks due this week from both seasonal and permanent plants
- [ ] Quick "Done" button on each task

---

## Phase 9: Family / Household Sharing

### Tables & RLS
- [ ] `households` table exists with `id`, `name`, `created_by`
- [ ] `household_members` table exists with `household_id`, `user_id`, `role`
- [ ] RLS policies allow access to data within the same household

### Settings UI
- [ ] Settings page "My Household" section visible
- [ ] "Create Household" button creates a new household
- [ ] Invite code is displayed for sharing
- [ ] "Join Household" allows entering an invite code
- [ ] Members list shows all household members with roles
- [ ] "Leave Household" button works

---

## Phase 10: PWA, Offline, and Mobile Polish

### 10a. PWA
- [ ] `public/manifest.json` exists with app name, icons, theme color, display mode
- [ ] `public/sw.js` service worker is registered
- [ ] App shell pages are pre-cached (/, /vault, /journal, /calendar, /settings)
- [ ] On mobile: "Add to Home Screen" prompt appears (or can be triggered manually)

### 10b. Offline Queue
- [ ] `src/lib/offlineQueue.ts` exists with IndexedDB operations
- [ ] `src/components/OfflineIndicator.tsx` shows connectivity status
- [ ] Disconnect from internet (airplane mode or DevTools Network offline)
- [ ] Amber "Offline -- changes will sync when reconnected" toast appears
- [ ] Reconnect -- "Back online -- all synced" toast appears
- [ ] If writes were queued during offline, they replay on reconnect

### 10c. Image Compression Everywhere
- [ ] Hero photo upload uses `compressImage()` -- verify in `vault/[id]/page.tsx`
- [ ] Journal photo upload uses `compressImage()` -- verify in `journal/page.tsx`
- [ ] Harvest modal photo uses `compressImage()` -- verify in `HarvestModal.tsx`
- [ ] Photo import uses `compressImage()` -- verify in `BatchAddSeed.tsx`
- [ ] Permanent plant photo uses `compressImage()` -- verify in `MyPlantsView.tsx`
- [ ] All uploaded images are < 1MB (check via Network tab)

### 10d. Soft Delete and Trash
- [ ] Deleting a plant profile sets `deleted_at` (not hard delete)
- [ ] Deleting a seed packet sets `deleted_at`
- [ ] All fetch queries include `.is("deleted_at", null)` -- deleted items don't appear in lists
- [ ] Settings Trash section shows deleted items with restore option
- [ ] "Permanent Delete" performs actual row deletion

### 10e. Mobile Polish
- [ ] All interactive elements have `min-w-[44px] min-h-[44px]` touch targets
- [ ] Modals use `max-h-[85vh]` with internal scroll
- [ ] Fixed bottom nav is 80px tall -- content is not obscured
- [ ] Test on mobile viewport (375px wide) -- no horizontal overflow
- [ ] Images use proper `object-cover` and don't stretch

---

## Cross-Cutting Concerns

### RLS & User ID (Law 1)
- [ ] Every database INSERT includes `user_id: user.id`
- [ ] Every SELECT/UPDATE/DELETE scopes to `.eq("user_id", user.id)`

### Soft Delete (Law 2)
- [ ] Deletions use `update({ deleted_at: now })` not `.delete()`
- [ ] Fetch queries include `.is("deleted_at", null)`

### Seed Packet Volume (Law 3)
- [ ] `qty_status` is a percentage (0-100)
- [ ] Planting decrements, never deletes the packet row
- [ ] Packet archived when qty reaches 0
- [ ] Profile goes `out_of_stock` when all packets archived/empty

### Image Compression (Law 4)
- [ ] All image upload paths use `compressImage()` before uploading

### Smart Camera (Law 5)
- [ ] Photo capture uses `capture="environment"` on mobile
- [ ] Desktop uses `getUserMedia` webcam

### Plant Profile Image Hierarchy (Law 7)
- [ ] Display fallback: hero_image_url > hero_image_path > journal photo > packet image > sprout emoji

### Source URL Preservation (Law 8)
- [ ] Original vendor link saved in `purchase_url` column on seed packets

### Entry Types (Law 9)
- [ ] All journal inserts set `entry_type` explicitly

### Profile Type Distinction (Law 10)
- [ ] Seed profiles show: About, Packets, Plantings, Journal tabs
- [ ] Permanent profiles show: About, Care, Journal tabs

### Care Schedule Architecture (Law 11)
- [ ] Templates (`is_template: true`) live on `plant_profile_id`
- [ ] Instance schedules (`is_template: false`) live on `grow_instance_id`
- [ ] `generateCareTasks()` creates tasks from due schedules
- [ ] `advanceCareSchedule()` bumps next due date after completion
- [ ] `copyCareTemplatesToInstance()` runs during planting

---

## Smoke Test Workflow

Run through this end-to-end scenario to verify core flows work together:

1. [ ] **Settings**: Set planting zone to "10b", set location via "Use My Location"
2. [ ] **Import**: Paste a seed vendor URL, verify it imports with hero image
3. [ ] **Profile**: Open the imported profile, verify About tab data
4. [ ] **Care Template**: Add "Fertilize every 14 days" care template on the About tab
5. [ ] **Plant**: Click "Plant", set location to "Raised Bed 1", adjust packet usage to 50%, confirm
6. [ ] **Verify**: Check Active Garden -- new batch shows with location
7. [ ] **Quick-tap**: Tap the Water icon on the batch -- verify toast and journal entry
8. [ ] **Harvest**: Click Harvest, enter 2 lbs, save -- verify yield updates on profile
9. [ ] **Journal**: Check Journal page, switch to Timeline view -- verify entries grouped by plant
10. [ ] **End Batch**: End the batch as "Harvested All" -- verify status changes
11. [ ] **History**: Check `/vault/history` -- grow instance visible with all details
12. [ ] **Packets**: Check `/vault/packets` -- packet visible with decremented qty
13. [ ] **Dashboard**: Verify frost alert (if applicable), care tasks, weather
14. [ ] **Permanent Plant**: Add a permanent plant via "My Plants" tab, add care schedule
15. [ ] **Household**: Create household in Settings, verify invite code shows
16. [ ] **Offline**: Toggle airplane mode, verify offline toast, toggle back, verify sync
17. [ ] **Export**: Export data from Settings, verify download contains expected data
18. [ ] **Trash**: Delete a profile, verify it appears in Trash, restore it
