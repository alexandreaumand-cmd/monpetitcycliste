-- Modifier la policy d'UPDATE pour autoriser les superadmins
DROP POLICY IF EXISTS "league_members_update" ON league_members;
CREATE POLICY "league_members_update"
ON league_members
FOR UPDATE
TO authenticated
USING (is_superadmin() OR is_league_admin(league_id))
WITH CHECK (is_superadmin() OR is_league_admin(league_id));

-- Modifier la policy de DELETE pour autoriser les superadmins
DROP POLICY IF EXISTS "league_members_delete" ON league_members;
CREATE POLICY "league_members_delete"
ON league_members
FOR DELETE
TO authenticated
USING (is_superadmin() OR is_league_admin(league_id));

-- Modifier la policy d'INSERT pour autoriser les superadmins
DROP POLICY IF EXISTS "league_members_insert" ON league_members;
CREATE POLICY "league_members_insert"
ON league_members
FOR INSERT
TO authenticated
WITH CHECK (is_superadmin() OR is_league_admin(league_id));