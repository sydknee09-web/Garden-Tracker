-- Weather Log: store temp, condition, wind with each journal entry (planting or manual).
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS weather_snapshot jsonb;

COMMENT ON COLUMN journal_entries.weather_snapshot IS 'Snapshot at entry time: { temp, condition, code, icon, wind_speed_mph } from open-meteo (Vista, CA).';
