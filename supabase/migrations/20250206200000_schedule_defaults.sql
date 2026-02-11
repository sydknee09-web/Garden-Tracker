-- Learning Brain: user-defined schedule defaults per plant type (overrides ZONE_10B_SCHEDULE constant).
CREATE TABLE IF NOT EXISTS schedule_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_type text NOT NULL,
  sun text,
  plant_spacing text,
  sowing_method text,
  planting_window text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, plant_type)
);

CREATE INDEX IF NOT EXISTS idx_schedule_defaults_user ON schedule_defaults (user_id);

ALTER TABLE schedule_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own schedule_defaults" ON schedule_defaults
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
