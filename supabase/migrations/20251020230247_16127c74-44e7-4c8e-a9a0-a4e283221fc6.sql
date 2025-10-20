-- Drop the conflicting ALL policy on rosters that interferes with SECURITY DEFINER functions
DROP POLICY IF EXISTS game_write_rosters ON rosters;

-- Create a new policy specifically for write operations (INSERT, UPDATE, DELETE)
-- This prevents interference with SELECT operations already covered by other policies
CREATE POLICY "Members can write to their league rosters" ON rosters
FOR INSERT
TO public
WITH CHECK ((league_id IS NULL) OR is_league_member(league_id));

CREATE POLICY "Members can update their league rosters" ON rosters
FOR UPDATE
TO public
USING ((league_id IS NULL) OR is_league_member(league_id))
WITH CHECK ((league_id IS NULL) OR is_league_member(league_id));

CREATE POLICY "Members can delete from their league rosters" ON rosters
FOR DELETE
TO public
USING ((league_id IS NULL) OR is_league_member(league_id));