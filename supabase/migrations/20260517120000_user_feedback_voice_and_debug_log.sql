-- §3.12-tester T1 + T2 — voice memo + debug-log attachments on user feedback.
-- Voice stored in journal-photos bucket: {user_id}/feedback-voice-{uuid}.{webm|m4a}
--   (RLS already path-prefix-only via 20250225000000_user_feedback_storage_rls.sql)
-- Debug log stored inline as text — capped at ~50 entries × ~250 chars ≈ 12.5 KB.
ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS voice_path text,
  ADD COLUMN IF NOT EXISTS debug_log_text text;

COMMENT ON COLUMN public.user_feedback.voice_path IS 'Optional voice memo path in journal-photos bucket. webm (Chrome/Android/Firefox/Edge) or m4a (iOS Safari).';
COMMENT ON COLUMN public.user_feedback.debug_log_text IS 'Optional opt-in debug log text (last ~50 console messages). Default OFF per T3 lock 2026-05-17.';
