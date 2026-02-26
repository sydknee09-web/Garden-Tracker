-- care_schedule_suggestions: AI-generated care recommendations for user to approve or reject.
-- When approved, converted to care_schedules. When rejected, deleted.
-- Same "Get AI suggestions" flow works for new and existing profiles with no care schedules.

CREATE TABLE IF NOT EXISTS care_schedule_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_profile_id uuid REFERENCES plant_profiles ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('fertilize','prune','spray','repot','harvest','mulch','other')),
  recurrence_type text NOT NULL DEFAULT 'interval'
    CHECK (recurrence_type IN ('interval','monthly','yearly','one_off')),
  interval_days integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE care_schedule_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own care_schedule_suggestions"
  ON care_schedule_suggestions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "household_care_schedule_suggestions_select"
  ON care_schedule_suggestions FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));

CREATE INDEX IF NOT EXISTS idx_care_schedule_suggestions_profile
  ON care_schedule_suggestions (plant_profile_id, user_id);

COMMENT ON TABLE care_schedule_suggestions IS
  'AI-generated care task suggestions. User approves (→ care_schedules) or rejects (→ delete).';
