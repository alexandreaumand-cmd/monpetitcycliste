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
    AND c.date_fin < (current_date - p_grace_days)
    AND (
      m.message_type IN ('admin_broadcast', 'live_update', 'live_event', 'recap')
      OR (m.message_type = 'system' AND m.author_manager_id IS NULL)
    );
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