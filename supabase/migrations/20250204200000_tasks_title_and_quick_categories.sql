-- Quick Add Task: title + categories Maintenance, Fertilize, Prune, General

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title text;

-- Allow plant_variety_id to be null for standalone tasks
ALTER TABLE tasks ALTER COLUMN plant_variety_id DROP NOT NULL;

-- Extend category constraint to include quick-task categories
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_category_check
  CHECK (category IN (
    'sow', 'harvest', 'start_seed', 'transplant', 'direct_sow',
    'maintenance', 'fertilize', 'prune', 'general'
  ));
