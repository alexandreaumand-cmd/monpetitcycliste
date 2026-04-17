-- SELECT bypass for superadmins
CREATE POLICY "leagues_read_superadmin" ON public.leagues
  FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "league_members_read_superadmin" ON public.league_members
  FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "league_invites_read_superadmin" ON public.league_invites
  FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "league_scopes_read_superadmin" ON public.league_scopes
  FOR SELECT TO authenticated USING (public.is_superadmin());

-- Extend UPDATE policies to allow superadmins
DROP POLICY IF EXISTS "leagues_update" ON public.leagues;
CREATE POLICY "leagues_update" ON public.leagues
  FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR public.is_league_admin(id))
  WITH CHECK (public.is_superadmin() OR public.is_league_admin(id));

DROP POLICY IF EXISTS "league_invites_update" ON public.league_invites;
CREATE POLICY "league_invites_update" ON public.league_invites
  FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR public.is_league_admin(league_id))
  WITH CHECK (public.is_superadmin() OR public.is_league_admin(league_id));