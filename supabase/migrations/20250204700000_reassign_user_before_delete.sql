-- Reassign all data from sydneysubscribed to sydknee09 before deleting the old user.
-- Run this in Supabase SQL Editor ONCE, then delete sydneysubscribed in Authentication → Users.
--
-- sydneysubscribed: a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026
-- sydknee09:       7e7d4799-69dd-4424-b57c-761741ba7060

DO $$
DECLARE
  old_uid uuid := 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026';
  new_uid uuid := '7e7d4799-69dd-4424-b57c-761741ba7060';
BEGIN
  UPDATE plant_varieties SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE seed_stocks SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE grow_instances SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE tasks SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE journal_entries SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE shopping_list SET user_id = new_uid WHERE user_id = old_uid;
END $$;
