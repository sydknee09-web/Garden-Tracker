-- Persistent import history for troubleshooting vendor issues.
CREATE TABLE IF NOT EXISTS public.seed_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  url text NOT NULL,
  vendor_name text,
  status_code int,
  identity_key_generated text,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_seed_import_logs_user_id ON public.seed_import_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_seed_import_logs_created_at ON public.seed_import_logs(created_at DESC);

ALTER TABLE public.seed_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own seed_import_logs"
  ON public.seed_import_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
