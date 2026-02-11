-- Primary image for plant profile (packet photo or vendor image)
ALTER TABLE plant_varieties ADD COLUMN IF NOT EXISTS primary_image_path text;

-- Storage bucket for batch seed packet photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('seed-packets', 'seed-packets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own seed packet photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'seed-packets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read seed packets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'seed-packets');
