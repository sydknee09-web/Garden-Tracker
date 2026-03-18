-- Display name for Elias intro and personalised dialogue. Syncs across devices.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
