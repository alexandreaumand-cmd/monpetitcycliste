-- The standings materialized view refresh is heavy and was being killed by the
-- default statement timeout, leaving the cache stale. Give it room to finish.
CREATE OR REPLACE FUNCTION public.refresh_standings_cache()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '180s'
AS $function$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_manager_standings_by_season_v2;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.v_manager_standings_by_season_v2;
  END;
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_manager_standings_by_phase_v2;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.v_manager_standings_by_phase_v2;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_standings_mv()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '180s'
AS $function$
BEGIN
  PERFORM public.refresh_standings_cache();
END;
$function$;