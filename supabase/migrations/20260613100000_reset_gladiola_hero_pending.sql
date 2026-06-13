-- One-time cleanup: reset the stranded hero_image_pending flag on Syd's Gladiola
-- White profile. The pre-fix client-side enrichment (enrichProfileFromName fired
-- fire-and-forget from the creation paths) stranded hero_image_pending=true when
-- the mobile tab suspended mid-enrichment, so the card "Researching…" pulse never
-- cleared. The creation paths now route through the durable ai_fill_jobs pipeline
-- (job worker resets the flag in a finally), so this is a one-time backfill for the
-- already-stuck row.
--
-- Idempotent: the `hero_image_pending = true` guard makes re-runs no-ops. Scoped by
-- user_id prefix + name + variety so it can only touch the intended row. The brief
-- supplied a truncated user_id (7e7d4799…); the prefix + name + variety combination
-- is precise enough for a single-row fix.
update public.plant_profiles
set hero_image_pending = false
where user_id::text like '7e7d4799%'
  and name = 'Gladiola'
  and variety_name = 'White'
  and hero_image_pending = true;
