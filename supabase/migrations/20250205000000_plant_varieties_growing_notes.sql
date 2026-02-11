-- Add growing notes / requirements to plant profile
ALTER TABLE plant_varieties ADD COLUMN IF NOT EXISTS growing_notes text;
