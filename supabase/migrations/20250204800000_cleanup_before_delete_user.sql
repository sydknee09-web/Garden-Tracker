-- 1) Reassign any remaining rows from sydneysubscribed to sydknee09
-- 2) Find any other references to the old user (run the SELECT after)
-- Run in Supabase SQL Editor, then try deleting the user again.

-- Reassign (run this first)
UPDATE plant_varieties SET user_id = '7e7d4799-69dd-4424-b57c-761741ba7060' WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026';
UPDATE seed_stocks SET user_id = '7e7d4799-69dd-4424-b57c-761741ba7060' WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026';
UPDATE grow_instances SET user_id = '7e7d4799-69dd-4424-b57c-761741ba7060' WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026';
UPDATE tasks SET user_id = '7e7d4799-69dd-4424-b57c-761741ba7060' WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026';
UPDATE journal_entries SET user_id = '7e7d4799-69dd-4424-b57c-761741ba7060' WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026';
UPDATE shopping_list SET user_id = '7e7d4799-69dd-4424-b57c-761741ba7060' WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026';

-- Check for ANY remaining references to the old user in public schema (run after the UPDATEs)
-- If this returns rows, that table is blocking the delete; we may need to update or add it above.
/*
SELECT 'plant_varieties' AS tbl, count(*) FROM plant_varieties WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026'
UNION ALL SELECT 'seed_stocks', count(*) FROM seed_stocks WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026'
UNION ALL SELECT 'grow_instances', count(*) FROM grow_instances WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026'
UNION ALL SELECT 'tasks', count(*) FROM tasks WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026'
UNION ALL SELECT 'journal_entries', count(*) FROM journal_entries WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026'
UNION ALL SELECT 'shopping_list', count(*) FROM shopping_list WHERE user_id = 'a6dd1cf7-7f5b-4c91-9d89-6eeb66c57026';
*/
