-- Drop the old unique constraint that doesn't include league_id
ALTER TABLE rosters 
DROP CONSTRAINT IF EXISTS rosters_phase_id_coureur_id_key;

-- Add new unique constraint including league_id
-- This allows the same rider to be in different leagues for the same phase
ALTER TABLE rosters 
ADD CONSTRAINT rosters_phase_coureur_league_key 
UNIQUE (phase_id, coureur_id, league_id);