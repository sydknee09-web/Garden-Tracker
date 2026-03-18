-- Appearance/Style for peaks — Japandi "Refined Luxury" pillar.
-- Stored in DB for sync across devices (remote desk, mobile).
-- See PEAK_PLANTING_WIZARD_SPEC Step 2, PEAK_JOURNAL_SPEC (Identity Icon on Map cards).
--
-- Appearance palette:
--   dark_walnut  — Deep, organic brown
--   navy         — Inky, midnight blue
--   slate        — The default; Japandi grey-blue
--   charcoal     — Soft black
--   burgundy     — Deep wine
--   forest       — Muted evergreen

ALTER TABLE mountains ADD COLUMN IF NOT EXISTS appearance_style TEXT DEFAULT 'slate'
  CHECK (appearance_style IN ('dark_walnut', 'navy', 'slate', 'charcoal', 'burgundy', 'forest'));
