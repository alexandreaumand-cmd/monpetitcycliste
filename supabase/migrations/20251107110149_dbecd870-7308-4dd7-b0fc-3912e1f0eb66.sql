-- Drop the existing function
DROP FUNCTION IF EXISTS public.admin_result_save_lot(text, type_classement, integer, jsonb);

-- Recreate with DELETE + INSERT strategy
CREATE OR REPLACE FUNCTION public.admin_result_save_lot(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero integer,
  p_rows jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saison_id uuid;
  v_rows_deleted int := 0;
  v_rows_inserted int := 0;
BEGIN
  -- Check admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  -- Get saison_id from course
  SELECT p.saison_id INTO v_saison_id
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE c.id = p_course_id;

  IF v_saison_id IS NULL THEN
    RAISE EXCEPTION 'Course not found or invalid: %', p_course_id;
  END IF;

  -- DELETE existing results for this (course_id, type_classement, etape_numero)
  DELETE FROM race_results
  WHERE course_id = p_course_id
    AND type_classement = p_type_classement
    AND (
      (p_etape_numero IS NULL AND etape_numero IS NULL)
      OR (p_etape_numero IS NOT NULL AND etape_numero = p_etape_numero)
    );
  
  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  -- INSERT new results from p_rows
  INSERT INTO race_results (
    course_id,
    saison_id,
    type_classement,
    etape_numero,
    coureur_id,
    position,
    position_decimal,
    points,
    statut,
    date_classement
  )
  SELECT
    p_course_id,
    v_saison_id,
    p_type_classement,
    p_etape_numero,
    (row_data->>'coureur_id')::text,
    (row_data->>'position')::integer,
    (row_data->>'position_decimal')::numeric,
    COALESCE((row_data->>'points')::integer, 0),
    COALESCE((row_data->>'statut')::result_statut, 'finished'),
    COALESCE((row_data->>'date_classement')::date, CURRENT_DATE)
  FROM jsonb_array_elements(p_rows) AS row_data
  WHERE (row_data->>'coureur_id') IS NOT NULL;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'course_id', p_course_id,
    'type_classement', p_type_classement,
    'etape_numero', p_etape_numero,
    'rows_deleted', v_rows_deleted,
    'rows_inserted', v_rows_inserted
  );
END;
$$;