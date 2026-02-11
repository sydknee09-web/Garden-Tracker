-- Brain Editor: 12 month checkboxes for "Sow this month" per plant type.
ALTER TABLE schedule_defaults
  ADD COLUMN IF NOT EXISTS sow_jan boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sow_feb boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sow_mar boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sow_apr boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sow_may boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sow_jun boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sow_jul boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sow_aug boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sow_sep boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sow_oct boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sow_nov boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sow_dec boolean DEFAULT false;
