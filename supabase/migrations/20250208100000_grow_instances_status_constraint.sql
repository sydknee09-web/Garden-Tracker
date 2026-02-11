-- 1. KILL the old constraint immediately so it stops blocking us
ALTER TABLE grow_instances 
DROP CONSTRAINT IF EXISTS grow_instances_status_check;

-- 2. Clean the data now that the guard is gone
UPDATE grow_instances 
SET status = 'growing' 
WHERE status = 'sown' OR status = 'Sown' OR status IS NULL;

-- 3. Standardize everything to lowercase
UPDATE grow_instances 
SET status = LOWER(TRIM(status));

-- 4. NOW add the new, correct guard that likes 'growing'
ALTER TABLE grow_instances 
ADD CONSTRAINT grow_instances_status_check 
CHECK (status IN ('pending', 'growing', 'harvested', 'archived'));

-- 5. Confirm the column default is also updated
ALTER TABLE grow_instances 
ALTER COLUMN status SET DEFAULT 'growing';