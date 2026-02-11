-- Optional: multiple images per packet (e.g. front + back). Primary image remains on seed_packets.primary_image_path.
CREATE TABLE IF NOT EXISTS public.packet_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_packet_id uuid NOT NULL REFERENCES public.seed_packets(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  sort_order smallint DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packet_images_seed_packet ON public.packet_images(seed_packet_id);
ALTER TABLE public.packet_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage packet_images via seed_packets"
  ON public.packet_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.seed_packets sp
      WHERE sp.id = seed_packet_id AND sp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seed_packets sp
      WHERE sp.id = seed_packet_id AND sp.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.packet_images IS 'Additional packet photos (e.g. back of packet). Primary packet image stays on seed_packets.primary_image_path. Profile hero is never overwritten by packet uploads.';
