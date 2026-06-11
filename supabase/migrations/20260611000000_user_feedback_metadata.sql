-- Pre-tester hardening — auto-captured device context on feedback submissions.
-- Companion to the FeedbackModal change that records user_agent, viewport, and
-- app version per submission (feedback channel audit 2026-06-10 rec #2 —
-- device-specific bug history U21/U22/U23 means testers won't volunteer
-- "Pixel 7, Chrome 126, 412×915"; the app carries it).
--
-- Additive + idempotent. admin_list_feedback() is RETURNS SETOF
-- public.user_feedback with SELECT *, so the new column flows through the
-- admin inbox RPC automatically — no function change needed.
ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.user_feedback.metadata IS
  'Auto-captured device context at submit time: user_agent, viewport_w, viewport_h, app_version. Nullable — rows from clients deployed before this column exist without it.';
