-- Function to delete all results and points (destructive action) - FIXED
CREATE OR REPLACE FUNCTION public.admin_results_reset_all(p_confirm_phrase text)
RETURNS json
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_results int;
  deleted_points int;
  v_manager_id uuid;
BEGIN
  -- Check admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  -- Check confirmation phrase
  IF p_confirm_phrase != 'RESET TOUS RESULTATS' THEN
    RAISE EXCEPTION 'Phrase de confirmation incorrecte';
  END IF;

  -- Get manager ID for audit
  SELECT id INTO v_manager_id FROM managers WHERE user_id = auth.uid() LIMIT 1;

  -- Delete all data in transaction (with WHERE TRUE to satisfy security requirements)
  DELETE FROM points_ledger WHERE TRUE;
  GET DIAGNOSTICS deleted_points = ROW_COUNT;

  DELETE FROM race_results WHERE TRUE;
  GET DIAGNOSTICS deleted_results = ROW_COUNT;

  -- Insert audit log
  INSERT INTO audits (actor_manager_id, action, payload_json, created_at)
  VALUES (
    v_manager_id,
    'admin_results_reset_all',
    json_build_object(
      'deleted_results', deleted_results,
      'deleted_points', deleted_points,
      'note', 'Purge complète des résultats et points'
    )::text,
    now()
  );

  RETURN json_build_object(
    'success', true,
    'deleted_results', deleted_results,
    'deleted_points', deleted_points
  );
END;
$$;