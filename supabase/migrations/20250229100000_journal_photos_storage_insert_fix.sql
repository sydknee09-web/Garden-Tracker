-- Fix "new row violates row-level security policy" on profile hero upload.
-- Use path prefix check instead of foldername() so INSERT always allows {user_id}/...

DROP POLICY IF EXISTS "Users can upload own journal photos" ON storage.objects;

CREATE POLICY "Users can upload own journal photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND name LIKE (auth.uid()::text || '/%')
  );
