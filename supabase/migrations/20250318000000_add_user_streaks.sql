-- Grace Day Streak: user_streaks table for Whetstone ritual.
-- See docs/GRACE_DAY_STREAK_SPEC.md
-- Option A (The Freeze): one miss = pause, two consecutive = reset.
-- 4:00 AM day boundary. last_completion_date normalized to Sanctuary date.

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id               UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak        INT NOT NULL DEFAULT 0,
  last_completion_date  DATE,         -- null if never completed; normalized to 4:00 AM logic
  grace_used            BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns their streak" ON user_streaks;
CREATE POLICY "User owns their streak"
  ON user_streaks FOR ALL
  USING (auth.uid() = user_id);
