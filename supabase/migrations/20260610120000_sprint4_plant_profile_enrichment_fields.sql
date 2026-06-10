-- Sprint 4 Chunk A — Plant profile enrichment depth + cache widening + source-artifact persistence.
-- ALL ADDITIVE + IDEMPOTENT (ADD COLUMN IF NOT EXISTS) → code-tier per CLAUDE.md SQL sub-tiers,
-- but a schema change, so applied via explicit greenlight (supabase db push) per the SQL push gate.
--
-- Three logical groups:
--   1. plant_profiles  — ~24 net-new AI-fillable columns (3-tag taxonomy, characteristics,
--                        per-season windows, paired summary/detail, taxonomy).
--   2. global_plant_library — widen the "botany brain" cache so a cache hit is as RICH as a
--                        fresh AI fill (closes the Canna self-perpetuating-thinness bug, audit §7.3).
--   3. journal_entries — source_url + source_po_ref so the add-flow persists the Link-import URL
--                        and PO line-item reference at vault_add time (Q10 lock, A6).
--
-- profile_type (Seasonal|Permanent) is intentionally LEFT UNTOUCHED — kept as derived back-compat
-- (Annual->seed, Perennial+Biennial->permanent). No destructive change this sprint.
--
-- Enum vocabularies are documented in COMMENTs and enforced at the prompt/app layer rather than
-- via DB CHECK constraints — AI-filled fields with a hard CHECK would fail the whole write on a
-- single off-list value, which is more fragile than prompt-level enforcement + app normalization.

-- =====================================================================================
-- 1. plant_profiles — new AI-fillable columns
-- =====================================================================================

-- Three-tag taxonomy (Q1 LOCKED, Syd 2026-06-10)
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS lifecycle text;
COMMENT ON COLUMN public.plant_profiles.lifecycle IS 'Annual | Biennial | Perennial. Supersedes profile_type (kept derived). AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS growth_form text;
COMMENT ON COLUMN public.plant_profiles.growth_form IS 'Tree | Shrub | Vine | Herbaceous | Grass | Groundcover | Bulb | Tuber. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS plant_category text;
COMMENT ON COLUMN public.plant_profiles.plant_category IS 'Flower | Fruit | Vegetable | Herb | Ornamental | Houseplant. AI-filled. Canonical home for the Library Seed-Type filter vocab.';

-- Characteristics
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS growth_habit text;
COMMENT ON COLUMN public.plant_profiles.growth_habit IS 'Spreading pattern: Vining | Bushing | Trailing | Mounding | Upright | Spreading | Climbing | Clumping. Distinct axis from growth_form. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS propagation_method text[];
COMMENT ON COLUMN public.plant_profiles.propagation_method IS 'Multi-select: Seed | Cutting | Division | Layering | Grafting | Bulb-Tuber division | Spore | Runner. Structured method (propagation_notes stays as HOW-TO narrative). AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS soil_preference text;
COMMENT ON COLUMN public.plant_profiles.soil_preference IS 'Short pill: e.g. Clay tolerant | Loam | Sandy | Well-drained | Acidic | Alkaline. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS disease_susceptibility text[];
COMMENT ON COLUMN public.plant_profiles.disease_susceptibility IS 'Array of common disease names. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS pollination_requirements text;
COMMENT ON COLUMN public.plant_profiles.pollination_requirements IS 'Self-pollinating | Cross-pollinating | Wind | Hand-pollination needed. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS toxicity text;
COMMENT ON COLUMN public.plant_profiles.toxicity IS 'Pet/human toxicity notes. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS deer_rabbit_resistance text;
COMMENT ON COLUMN public.plant_profiles.deer_rabbit_resistance IS 'Resistant | Partial | Susceptible | Unknown. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS wildlife_value text;
COMMENT ON COLUMN public.plant_profiles.wildlife_value IS 'Attracts pollinators / birds / butterflies notes. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS invasiveness text;
COMMENT ON COLUMN public.plant_profiles.invasiveness IS 'Invasiveness notes (carries regional nuance, so text not bool). AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS native_origin text;
COMMENT ON COLUMN public.plant_profiles.native_origin IS 'Geographic native range. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS drought_salt_tolerance text;
COMMENT ON COLUMN public.plant_profiles.drought_salt_tolerance IS 'Tolerant | Partial | Sensitive. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS synonyms text[];
COMMENT ON COLUMN public.plant_profiles.synonyms IS 'Alternative botanical/common names. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS uses text[];
COMMENT ON COLUMN public.plant_profiles.uses IS 'Multi-tag: Beds | Containers | Cuisine | Foliage interest | Outdoor | Indoor. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS special_features text[];
COMMENT ON COLUMN public.plant_profiles.special_features IS 'Multi-tag: Easy-care | Edible | Pollinator-friendly | Cut-and-come-again | Direct-sow | Fragrance | Bloom-first-year. AI-filled.';

-- Paired summary (pill) + detail (1-2 sentence) — see brief A1. Existing `water`/`sun` retained
-- (legacy summary); the new *_summary columns are the canonical pill, *_detail the narrative.
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS water_summary text;
COMMENT ON COLUMN public.plant_profiles.water_summary IS 'Pill tier: Consistent | Regular | Frequent | Minimal | Drought-tolerant. Pairs with water_detail. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS water_detail text;
COMMENT ON COLUMN public.plant_profiles.water_detail IS '1-2 sentence watering detail. Pairs with water_summary. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS sun_summary text;
COMMENT ON COLUMN public.plant_profiles.sun_summary IS 'Pill tier: Full Sun | Part Sun | Shade | Bright Indirect. Pairs with sun_detail. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS sun_detail text;
COMMENT ON COLUMN public.plant_profiles.sun_detail IS '1-2 sentence sun/light detail. Pairs with sun_summary. AI-filled.';

-- Harvest + per-season planting windows (additive; legacy planting_window text retained, Q5)
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS harvest_season text[];
COMMENT ON COLUMN public.plant_profiles.harvest_season IS 'Multi-value: {Early|Mid|Late} x {Spring|Summer|Fall|Winter}. Distinct from harvest_days. AI-filled.';
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS spring_indoor_window text;
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS spring_outdoor_window text;
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS summer_window text;
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS fall_outdoor_window text;

-- Transplant/planting depth — separate from sowing_depth (seed depth) per brief A1.
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS planting_depth numeric;
COMMENT ON COLUMN public.plant_profiles.planting_depth IS 'Transplant depth (inches), distinct from sowing_depth (seed depth). AI-filled.';

-- Taxonomy (scientific_name already exists; genus/family/species net-new)
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS family text;
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS genus text;
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS species text;

-- =====================================================================================
-- 2. global_plant_library — widen the botany-brain cache so a hit == a fresh AI fill.
--    Closes the self-perpetuating thinness bug (audit §7.3): the AI branch can now write
--    the full field set, and the cache read returns it. NORTH_STAR §1 (one path, one depth).
-- =====================================================================================

-- Deep narrative / core-care fields that were previously unreachable through the cache path
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS growing_notes text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS propagation_notes text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS seed_saving_notes text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS seed_propagation_context text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS companion_plants text[];
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS avoid_plants text[];
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS planting_window text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS sowing_depth text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS sowing_method text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS scientific_name text;

-- New Sprint 4 fields mirrored into the library so cache hits carry them too
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS lifecycle text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS growth_form text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS plant_category text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS growth_habit text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS propagation_method text[];
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS soil_preference text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS disease_susceptibility text[];
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS pollination_requirements text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS toxicity text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS deer_rabbit_resistance text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS wildlife_value text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS invasiveness text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS native_origin text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS drought_salt_tolerance text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS synonyms text[];
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS uses text[];
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS special_features text[];
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS water_summary text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS water_detail text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS sun_summary text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS sun_detail text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS harvest_season text[];
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS spring_indoor_window text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS spring_outdoor_window text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS summer_window text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS fall_outdoor_window text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS planting_depth numeric;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS family text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS genus text;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS species text;

-- =====================================================================================
-- 3. journal_entries — acquisition source-artifact persistence (Q10 lock, A6 write-path)
-- =====================================================================================
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS source_url text;
COMMENT ON COLUMN public.journal_entries.source_url IS 'Link-import source URL captured at vault_add time (Q10). Rendered by the instance Sources section (Chunk D2).';
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS source_po_ref text;
COMMENT ON COLUMN public.journal_entries.source_po_ref IS 'PO-import file reference / line-item context captured at vault_add time (Q10). Rendered by the instance Sources section (Chunk D2).';
