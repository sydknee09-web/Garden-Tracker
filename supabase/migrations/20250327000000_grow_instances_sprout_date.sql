-- Add sprout_date to grow_instances for days_to_germinate display
-- Set when user logs germination; days_to_germinate = sprout_date - sown_date

ALTER TABLE grow_instances
  ADD COLUMN IF NOT EXISTS sprout_date date;

COMMENT ON COLUMN grow_instances.sprout_date IS 'Date seeds sprouted; set when logging germination. Used to compute actual days_to_germinate.';
