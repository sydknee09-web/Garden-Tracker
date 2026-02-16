-- Clear scraped HTML/code from plant_profiles.scientific_name (e.g. "-tulips" class="header__menu-item...").
-- Matches the same junk patterns as looksLikeScientificName() in the app so DB and UI stay consistent.
UPDATE public.plant_profiles
SET scientific_name = NULL
WHERE scientific_name IS NOT NULL
  AND (
    scientific_name ~* 'class\s*=\s*[''"]'   -- class=" or class='
    OR scientific_name ~* 'id\s*=\s*[''"]'
    OR scientific_name LIKE '%__%'             -- BEM / internal strings
    OR scientific_name LIKE '%<%'
    OR scientific_name LIKE '%>%'
    OR scientific_name ~ '^"[^"]*"$'         -- entire value is just "something"
  );
