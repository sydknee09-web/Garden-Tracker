-- 1. Manual Shopping List with Hard-Archive Logic (is_purchased = true → hidden everywhere)
CREATE TABLE IF NOT EXISTS public.shopping_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plant_profile_id UUID REFERENCES public.plant_profiles(id) ON DELETE CASCADE,
    is_purchased BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own shopping list" ON public.shopping_list;
CREATE POLICY "Users manage own shopping list" ON public.shopping_list FOR ALL USING (auth.uid() = user_id);

-- 2. Plant Profiles: Perenual & Auto-Brain
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS perenual_id INTEGER;
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS scientific_name TEXT;
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS botanical_care_notes JSONB;

-- 3. Seed Packets: Overrides & Status
ALTER TABLE public.seed_packets ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE public.seed_packets ADD COLUMN IF NOT EXISTS user_notes TEXT;
