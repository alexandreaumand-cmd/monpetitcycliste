-- Step 1: Clean up orphaned race_results by creating missing result_sets
INSERT INTO race_result_sets (course_id, type_classement, etape_numero, created_by)
SELECT DISTINCT 
  rr.course_id,
  rr.type_classement,
  CASE WHEN rr.type_classement = 'Etape' THEN rr.etape_numero ELSE NULL END,
  COALESCE(rr.updated_by_manager_id, (SELECT id FROM managers LIMIT 1))
FROM race_results rr
WHERE rr.result_set_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM race_result_sets rs
    WHERE rs.course_id = rr.course_id
      AND rs.type_classement = rr.type_classement
      AND (
        (rr.type_classement = 'Etape' AND rs.etape_numero = rr.etape_numero)
        OR (rr.type_classement != 'Etape' AND rs.etape_numero IS NULL)
      )
  );

-- Step 2: Link orphaned results to their result_set
UPDATE race_results rr
SET result_set_id = rs.id
FROM race_result_sets rs
WHERE rr.result_set_id IS NULL
  AND rr.course_id = rs.course_id
  AND rr.type_classement = rs.type_classement
  AND (
    (rr.type_classement = 'Etape' AND rr.etape_numero = rs.etape_numero)
    OR (rr.type_classement != 'Etape' AND rs.etape_numero IS NULL)
  );

-- Step 3: Create unified UPSERT function
CREATE OR REPLACE FUNCTION public.admin_result_save_lot(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero int,
  p_rows jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_manager_id uuid;
  v_result_set_id uuid;
  v_row jsonb;
  v_date_classement date;
  v_total_rows int := 0;
BEGIN
  -- Check admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  -- Get manager ID
  SELECT id INTO v_manager_id FROM managers WHERE user_id = auth.uid() LIMIT 1;

  -- Get or create result_set
  SELECT id INTO v_result_set_id
  FROM race_result_sets
  WHERE course_id = p_course_id
    AND type_classement = p_type_classement
    AND (
      (p_type_classement = 'Etape' AND etape_numero = p_etape_numero)
      OR (p_type_classement != 'Etape' AND etape_numero IS NULL)
    );

  IF v_result_set_id IS NULL THEN
    INSERT INTO race_result_sets (course_id, type_classement, etape_numero, created_by)
    VALUES (p_course_id, p_type_classement, p_etape_numero, v_manager_id)
    RETURNING id INTO v_result_set_id;
  END IF;

  -- Get course date
  SELECT COALESCE(date_fin, date_debut) 
  INTO v_date_classement
  FROM courses WHERE id = p_course_id;

  -- UPSERT all rows using ON CONFLICT
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO race_results (
      result_set_id,
      course_id,
      type_classement,
      etape_numero,
      coureur_id,
      position,
      statut,
      date_classement,
      updated_by_manager_id
    )
    VALUES (
      v_result_set_id,
      p_course_id,
      p_type_classement,
      p_etape_numero,
      (v_row->>'coureur_id')::text,
      (v_row->>'position')::int,
      (v_row->>'statut')::result_statut,
      v_date_classement,
      v_manager_id
    )
    ON CONFLICT (course_id, type_classement, COALESCE(etape_numero, -1), position)
    DO UPDATE SET
      coureur_id = EXCLUDED.coureur_id,
      statut = EXCLUDED.statut,
      result_set_id = EXCLUDED.result_set_id,
      updated_by_manager_id = EXCLUDED.updated_by_manager_id,
      updated_at = now()
    WHERE race_results.coureur_id IS DISTINCT FROM EXCLUDED.coureur_id
       OR race_results.statut IS DISTINCT FROM EXCLUDED.statut;

    v_total_rows := v_total_rows + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'result_set_id', v_result_set_id,
    'rows_affected', v_total_rows
  );
END;
$$;

-- Step 4: Drop old functions (no longer needed)
DROP FUNCTION IF EXISTS public.admin_result_create_lot(text, type_classement, integer, jsonb);
DROP FUNCTION IF EXISTS public.admin_result_update_lot(text, type_classement, integer, jsonb);
DROP FUNCTION IF EXISTS public.admin_result_check_unique(text, type_classement, integer);