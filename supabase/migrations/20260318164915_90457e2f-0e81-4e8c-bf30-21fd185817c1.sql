-- Fix: restrict league_startlist_notes INSERT/UPDATE to league admins only
DROP POLICY IF EXISTS "Authenticated users can insert league startlist notes" ON public.league_startlist_notes;
DROP POLICY IF EXISTS "Authenticated users can update league startlist notes" ON public.league_startlist_notes;

CREATE POLICY "League admins can insert startlist notes"
ON public.league_startlist_notes FOR INSERT
TO authenticated
WITH CHECK (public.is_league_admin(league_id));

CREATE POLICY "League admins can update startlist notes"
ON public.league_startlist_notes FOR UPDATE
TO authenticated
USING (public.is_league_admin(league_id))
WITH CHECK (public.is_league_admin(league_id));