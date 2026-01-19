-- Add league_id column to startlist_manager_ratings
ALTER TABLE startlist_manager_ratings 
ADD COLUMN league_id UUID REFERENCES leagues(id);

-- Drop the old unique constraint
ALTER TABLE startlist_manager_ratings 
DROP CONSTRAINT IF EXISTS startlist_manager_ratings_startlist_id_manager_id_rated_by_key;

-- Create new unique index including league_id
CREATE UNIQUE INDEX startlist_manager_ratings_unique 
ON startlist_manager_ratings (startlist_id, manager_id, rated_by, league_id);

-- Add index for league-based queries
CREATE INDEX idx_startlist_manager_ratings_league 
ON startlist_manager_ratings (startlist_id, league_id);