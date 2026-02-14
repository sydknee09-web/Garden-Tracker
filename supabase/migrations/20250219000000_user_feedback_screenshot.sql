-- Add screenshot attachment to user feedback (bug reports, feature requests).
-- Screenshot stored in journal-photos bucket: {user_id}/feedback-{uuid}.jpg
ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS screenshot_path text;

COMMENT ON COLUMN public.user_feedback.screenshot_path IS 'Optional screenshot path in journal-photos bucket for bug reports.';
