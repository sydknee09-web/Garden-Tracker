-- Ensure feedback screenshot uploads to journal-photos pass RLS.
-- Path format: {user_id}/feedback-{uuid}.jpg — first segment must match authenticated user.

DROP POLICY IF EXISTS "Users can upload own journal photos" ON storage.objects;

CREATE POLICY "Users can upload own journal photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
