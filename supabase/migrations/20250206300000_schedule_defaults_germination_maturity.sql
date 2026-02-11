-- Add germination and maturity to Teach the Brain (schedule_defaults).
ALTER TABLE schedule_defaults
  ADD COLUMN IF NOT EXISTS days_to_germination text,
  ADD COLUMN IF NOT EXISTS harvest_days integer;
