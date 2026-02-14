-- User feedback from in-app feedback button (header).
-- Review in Supabase dashboard or Settings → Feedback (own submissions).
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  message text NOT NULL,
  category text,
  page_url text,
  user_email text
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON public.user_feedback(created_at DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON public.user_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback (for confirmation in Settings)
CREATE POLICY "Users can read own feedback"
  ON public.user_feedback
  FOR SELECT
  USING (auth.uid() = user_id);
