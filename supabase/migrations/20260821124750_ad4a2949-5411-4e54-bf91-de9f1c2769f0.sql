ALTER FUNCTION public.get_manager_standings_by_phase(uuid, uuid) SECURITY DEFINER;
ALTER FUNCTION public.get_manager_standings_by_season(uuid, uuid) SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.get_manager_standings_by_phase(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_manager_standings_by_season(uuid, uuid) FROM anon;