-- User blocklist of tag names: AI-extracted tags matching these are filtered out before saving.
CREATE TABLE IF NOT EXISTS public.blocked_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tag_name)
);

CREATE INDEX IF NOT EXISTS idx_blocked_tags_user_id ON public.blocked_tags(user_id);

ALTER TABLE public.blocked_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blocked_tags"
  ON public.blocked_tags
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
