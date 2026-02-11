CREATE TABLE IF NOT EXISTS public.tag_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'bg-neutral-100 text-neutral-700 border-neutral-200',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tag_settings_user_id ON public.tag_settings(user_id);

ALTER TABLE public.tag_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tag_settings"
  ON public.tag_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
