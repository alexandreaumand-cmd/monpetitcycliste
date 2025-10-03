-- Function to clean courses and phases
CREATE OR REPLACE FUNCTION public.admin_clean_courses_phases(p_confirm_phrase text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_courses int;
  deleted_phases int;
  v_manager_id uuid;
BEGIN
  -- Check admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  -- Check confirmation phrase
  IF p_confirm_phrase != 'NETTOYER COURSES PHASES' THEN
    RAISE EXCEPTION 'Phrase de confirmation incorrecte';
  END IF;

  -- Get manager ID for audit
  SELECT id INTO v_manager_id FROM managers WHERE user_id = auth.uid() LIMIT 1;

  -- Delete all courses
  DELETE FROM courses WHERE TRUE;
  GET DIAGNOSTICS deleted_courses = ROW_COUNT;

  -- Delete all phases
  DELETE FROM phases WHERE TRUE;
  GET DIAGNOSTICS deleted_phases = ROW_COUNT;

  -- Insert audit log
  INSERT INTO audits (actor_manager_id, action, payload_json, created_at)
  VALUES (
    v_manager_id,
    'admin_clean_courses_phases',
    json_build_object(
      'deleted_courses', deleted_courses,
      'deleted_phases', deleted_phases,
      'note', 'Nettoyage complet des courses et phases'
    )::text,
    now()
  );

  RETURN json_build_object(
    'success', true,
    'deleted_courses', deleted_courses,
    'deleted_phases', deleted_phases
  );
END;
$function$;