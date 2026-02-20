-- Add household peer-read policy for care_schedules.
-- All other shared tables (plant_profiles, seed_packets, grow_instances,
-- journal_entries, tasks) already have household SELECT policies; this fills
-- the gap so family-view profile pages can show care schedules owned by
-- other household members.

CREATE POLICY "household_care_schedules_select" ON public.care_schedules
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));
