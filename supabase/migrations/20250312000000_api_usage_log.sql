-- API usage log for tracking Gemini, OpenAI, Perenual calls (billing/limits visibility)
CREATE TABLE api_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('gemini', 'openai', 'perenual')),
  operation text NOT NULL,
  created_at timestamptz DEFAULT now(),
  tokens integer,
  metadata jsonb
);

CREATE INDEX idx_api_usage_log_user_created ON api_usage_log(user_id, created_at DESC);

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;

-- Users see only their own logs
CREATE POLICY "Users see own usage" ON api_usage_log
  FOR SELECT USING (auth.uid() = user_id);

-- Inserts happen server-side via service role (bypasses RLS); no user INSERT policy needed
