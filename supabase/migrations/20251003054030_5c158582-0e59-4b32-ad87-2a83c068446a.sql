
-- Add points column to race_results to store raw points for each rider's result
ALTER TABLE race_results 
ADD COLUMN points INTEGER NOT NULL DEFAULT 0;

-- Add a comment to explain the column
COMMENT ON COLUMN race_results.points IS 'Points earned by the rider for this result based on scoring rules';
