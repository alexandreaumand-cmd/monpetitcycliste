-- Add is_cancelled column to race_result_sets table
ALTER TABLE race_result_sets 
ADD COLUMN is_cancelled BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN race_result_sets.is_cancelled IS 'Indicates if this race/stage was cancelled. When true, no results should exist for this result set.';