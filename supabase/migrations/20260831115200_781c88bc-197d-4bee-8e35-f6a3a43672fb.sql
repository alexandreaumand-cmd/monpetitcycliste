-- 1. Keep the heavy computation available under a "_live" name
ALTER VIEW public.v_manager_standings_by_season_v2 RENAME TO v_manager_standings_by_season_live;
ALTER VIEW public.v_manager_standings_by_phase_v2 RENAME TO v_manager_standings_by_phase_live;

-- 2. Materialized caches exposed under the original names (no app change needed)
CREATE MATERIALIZED VIEW public.v_manager_standings_by_season_v2 AS
SELECT * FROM public.v_manager_standings_by_season_live
WHERE manager_id IS NOT NULL AND league_id IS NOT NULL AND saison_id IS NOT NULL;

CREATE MATERIALIZED VIEW public.v_manager_standings_by_phase_v2 AS
SELECT * FROM public.v_manager_standings_by_phase_live
WHERE manager_id IS NOT NULL AND league_id IS NOT NULL AND phase_id IS NOT NULL;

CREATE UNIQUE INDEX uq_standings_season_cache
  ON public.v_manager_standings_by_season_v2 (league_id, saison_id, manager_id);
CREATE INDEX idx_standings_season_cache_lookup
  ON public.v_manager_standings_by_season_v2 (league_id, saison_id, total_points DESC);

CREATE UNIQUE INDEX uq_standings_phase_cache
  ON public.v_manager_standings_by_phase_v2 (league_id, phase_id, manager_id);
CREATE INDEX idx_standings_phase_cache_lookup
  ON public.v_manager_standings_by_phase_v2 (league_id, phase_id, total_points DESC);

GRANT SELECT ON public.v_manager_standings_by_season_v2 TO anon, authenticated;
GRANT ALL ON public.v_manager_standings_by_season_v2 TO service_role;
GRANT SELECT ON public.v_manager_standings_by_phase_v2 TO anon, authenticated;
GRANT ALL ON public.v_manager_standings_by_phase_v2 TO service_role;

GRANT SELECT ON public.v_manager_standings_by_season_live TO anon, authenticated;
GRANT ALL ON public.v_manager_standings_by_season_live TO service_role;
GRANT SELECT ON public.v_manager_standings_by_phase_live TO anon, authenticated;
GRANT ALL ON public.v_manager_standings_by_phase_live TO service_role;

-- 3. Refresh entry points
CREATE OR REPLACE FUNCTION public.refresh_standings_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
AS $function$
BEGIN
  PERFORM public.refresh_standings_cache();
END;
$function$;

CREATE OR REPLACE FUNCTION public.n_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.refresh_standings_cache();
END;
$function$;

CREATE OR REPLACE FUNCTION public.n_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.refresh_standings_cache();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.refresh_standings_cache() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_standings_mv() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.n_mv() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.n_views() TO authenticated, service_role;

-- 4. Retention: purge old operational history
CREATE OR REPLACE FUNCTION public.purge_old_app_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d_runs integer := 0;
  d_changes integer := 0;
  d_activity integer := 0;
  d_arena integer := 0;
  d_notif integer := 0;
BEGIN
  DELETE FROM public.startlist_tracker_runs WHERE started_at < now() - interval '30 days';
  GET DIAGNOSTICS d_runs = ROW_COUNT;

  DELETE FROM public.startlist_tracker_changes
  WHERE detected_at < now() - interval '120 days' AND processed = true;
  GET DIAGNOSTICS d_changes = ROW_COUNT;

  DELETE FROM public.user_activity_logs WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS d_activity = ROW_COUNT;

  DELETE FROM public.arena_messages
  WHERE created_at < now() - interval '120 days'
    AND author_manager_id IS NULL
    AND message_type IN ('live_update', 'live_event', 'system', 'recap');
  GET DIAGNOSTICS d_arena = ROW_COUNT;

  d_notif := public.purge_old_notifications();

  RETURN jsonb_build_object(
    'startlist_tracker_runs', d_runs,
    'startlist_tracker_changes', d_changes,
    'user_activity_logs', d_activity,
    'arena_messages', d_arena,
    'notifications', d_notif
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.purge_old_app_data() TO service_role;