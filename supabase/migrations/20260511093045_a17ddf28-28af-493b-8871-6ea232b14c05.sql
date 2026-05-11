ALTER TABLE public._debug_standings_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._debug_standings_audit FROM anon, authenticated;
CREATE POLICY "superadmins_only_audit"
  ON public._debug_standings_audit
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());