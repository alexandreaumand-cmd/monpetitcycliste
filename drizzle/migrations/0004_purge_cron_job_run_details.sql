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
  d_cron integer := 0;
  d_live jsonb;
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

  d_live := public.purge_live_broadcast_data(3);

  BEGIN
    DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days';
    GET DIAGNOSTICS d_cron = ROW_COUNT;
  EXCEPTION WHEN others THEN
    d_cron := -1;
  END;

  RETURN jsonb_build_object(
    'startlist_tracker_runs', d_runs,
    'startlist_tracker_changes', d_changes,
    'user_activity_logs', d_activity,
    'arena_messages', d_arena,
    'notifications', d_notif,
    'cron_job_run_details', d_cron,
    'live_broadcast', d_live
  );
END;
$function$;