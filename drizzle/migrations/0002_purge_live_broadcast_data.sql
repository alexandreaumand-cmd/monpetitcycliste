CREATE OR REPLACE FUNCTION public.purge_live_broadcast_data(p_grace_days integer DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d_msgs integer := 0;
  d_plans integer := 0;
  d_live integer := 0;
BEGIN
  DELETE FROM public.arena_messages m
  USING public.courses c
  WHERE c.id = m.course_id
    AND m.author_manager_id IS NULL
    AND m.message_type IN ('admin_broadcast', 'system')
    AND c.date_fin < (current_date - p_grace_days);
  GET DIAGNOSTICS d_msgs = ROW_COUNT;

  DELETE FROM public.live_stage_plans p
  USING public.courses c
  WHERE c.id = p.course_id
    AND c.date_fin < (current_date - p_grace_days);
  GET DIAGNOSTICS d_plans = ROW_COUNT;

  DELETE FROM public.arena_live_courses a
  USING public.courses c
  WHERE c.id = a.course_id
    AND c.date_fin < (current_date - p_grace_days);
  GET DIAGNOSTICS d_live = ROW_COUNT;

  RETURN jsonb_build_object(
    'arena_messages', d_msgs,
    'live_stage_plans', d_plans,
    'arena_live_courses', d_live
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_live_broadcast_data(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_live_broadcast_data(integer) TO service_role;

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

  RETURN jsonb_build_object(
    'startlist_tracker_runs', d_runs,
    'startlist_tracker_changes', d_changes,
    'user_activity_logs', d_activity,
    'arena_messages', d_arena,
    'notifications', d_notif,
    'live_broadcast', d_live
  );
END;
$function$;