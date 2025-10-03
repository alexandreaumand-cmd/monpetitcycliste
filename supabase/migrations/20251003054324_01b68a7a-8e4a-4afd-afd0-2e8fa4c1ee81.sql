
-- Add manager_id column to race_results to store which manager owned the rider at the time of the race
ALTER TABLE race_results 
ADD COLUMN manager_id UUID NULL REFERENCES managers(id);

-- Add index for better query performance
CREATE INDEX idx_race_results_manager_id ON race_results(manager_id);

-- Add a comment to explain the column
COMMENT ON COLUMN race_results.manager_id IS 'Manager who owned this rider at the time of the race (via rosters table). NULL if rider was not in any roster.';
