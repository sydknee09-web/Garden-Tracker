-- Allow app to work without login when using NEXT_PUBLIC_DEV_USER_ID.
-- Anon can insert/select/update/delete seed_stocks where user_id = this UUID.
-- Replace the UUID below with your dev user (sydknee09: 7e7d4799-69dd-4424-b57c-761741ba7060).
-- Remove this policy when you enable the login page.

DROP POLICY IF EXISTS "Dev user: anon can manage seed_stocks for single user" ON seed_stocks;
CREATE POLICY "Dev user: anon can manage seed_stocks for single user"
  ON seed_stocks FOR ALL
  TO anon
  USING (user_id = '7e7d4799-69dd-4424-b57c-761741ba7060'::uuid)
  WITH CHECK (user_id = '7e7d4799-69dd-4424-b57c-761741ba7060'::uuid);
