-- Add onboarding completion timestamp to user_settings.
-- When set, the 3-step Quick Start dock is hidden permanently (cross-device).

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
COMMENT ON COLUMN user_settings.onboarding_completed_at IS 'When user completed the 3-step Quick Start; null = show dock.';
