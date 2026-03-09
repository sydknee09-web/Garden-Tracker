-- Fix: Replace partial unique index with full unique index so ON CONFLICT works.
-- PostgreSQL cannot use partial unique indexes for ON CONFLICT (column_list) unless
-- the WHERE clause is specified; Supabase/PostgREST does not support that.
-- A full unique index on (user_id, plant_profile_id) allows multiple (user_id, NULL)
-- rows (placeholders) since NULL != NULL in SQL, so placeholder behavior is preserved.

DROP INDEX IF EXISTS public.idx_shopping_list_user_profile;
CREATE UNIQUE INDEX idx_shopping_list_user_profile
  ON public.shopping_list (user_id, plant_profile_id);
