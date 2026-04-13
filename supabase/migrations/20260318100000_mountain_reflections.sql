-- Journal / reflection fields for Elias climb prompts (v0.1.2)
ALTER TABLE mountains ADD COLUMN IF NOT EXISTS reflection_why TEXT;
ALTER TABLE mountains ADD COLUMN IF NOT EXISTS reflection_pack TEXT;
