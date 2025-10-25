-- Politique SELECT pour les membres sur league_scopes (utilise is_league_member existant)
DROP POLICY IF EXISTS "Members can view their league scopes" ON public.league_scopes;
CREATE POLICY "Members can view their league scopes"
ON public.league_scopes
FOR SELECT
TO authenticated
USING (public.is_league_member(league_id));

-- Politique SELECT ouverte aux authentifiés sur saisons (table non sensible)
DROP POLICY IF EXISTS "Authenticated can read saisons" ON public.saisons;
CREATE POLICY "Authenticated can read saisons"
ON public.saisons
FOR SELECT
TO authenticated
USING (true);