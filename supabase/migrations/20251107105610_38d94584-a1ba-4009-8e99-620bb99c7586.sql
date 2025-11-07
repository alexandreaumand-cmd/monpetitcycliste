-- Drop and recreate admin_result_save_lot function to use ON CONFLICT ON CONSTRAINT
DROP FUNCTION IF EXISTS admin_result_save_lot(text, type_classement, integer, jsonb);

CREATE FUNCTION admin_result_save_lot(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero integer,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row jsonb;
  v_coureur_id text;
  v_position integer;
  v_position_decimal numeric;
  v_statut result_statut;
  v_date_classement date;
  v_manager_id uuid;
  v_points integer;
  v_saison_id uuid;
  v_updated_by_manager_id uuid;
  v_rows_inserted integer := 0;
BEGIN
  -- Get the saison_id from the course
  SELECT p.saison_id INTO v_saison_id
  FROM courses c
  JOIN phases p ON c.phase_id = p.id
  WHERE c.id = p_course_id;

  -- Get the current manager ID from auth
  SELECT id INTO v_updated_by_manager_id
  FROM managers
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Loop through each row in the array
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_coureur_id := v_row->>'coureur_id';
    v_position := (v_row->>'position')::integer;
    v_position_decimal := (v_row->>'position_decimal')::numeric;
    v_statut := (v_row->>'statut')::result_statut;
    v_date_classement := (v_row->>'date_classement')::date;
    v_manager_id := (v_row->>'manager_id')::uuid;
    v_points := (v_row->>'points')::integer;

    -- Insert or update the race result using the correct constraint
    IF p_etape_numero IS NULL THEN
      -- For final classifications (etape_numero IS NULL)
      INSERT INTO race_results (
        course_id,
        coureur_id,
        type_classement,
        etape_numero,
        position,
        position_decimal,
        statut,
        date_classement,
        manager_id,
        points,
        saison_id,
        updated_by_manager_id
      )
      VALUES (
        p_course_id,
        v_coureur_id,
        p_type_classement,
        p_etape_numero,
        v_position,
        v_position_decimal,
        v_statut,
        v_date_classement,
        v_manager_id,
        v_points,
        v_saison_id,
        v_updated_by_manager_id
      )
      ON CONFLICT ON CONSTRAINT idx_race_results_final_unique_smart
      DO UPDATE SET
        position = EXCLUDED.position,
        position_decimal = EXCLUDED.position_decimal,
        statut = EXCLUDED.statut,
        date_classement = EXCLUDED.date_classement,
        manager_id = EXCLUDED.manager_id,
        points = EXCLUDED.points,
        updated_by_manager_id = EXCLUDED.updated_by_manager_id,
        updated_at = now();
    ELSE
      -- For stage classifications (etape_numero IS NOT NULL)
      INSERT INTO race_results (
        course_id,
        coureur_id,
        type_classement,
        etape_numero,
        position,
        position_decimal,
        statut,
        date_classement,
        manager_id,
        points,
        saison_id,
        updated_by_manager_id
      )
      VALUES (
        p_course_id,
        v_coureur_id,
        p_type_classement,
        p_etape_numero,
        v_position,
        v_position_decimal,
        v_statut,
        v_date_classement,
        v_manager_id,
        v_points,
        v_saison_id,
        v_updated_by_manager_id
      )
      ON CONFLICT ON CONSTRAINT idx_race_results_stage_unique_smart
      DO UPDATE SET
        position = EXCLUDED.position,
        position_decimal = EXCLUDED.position_decimal,
        statut = EXCLUDED.statut,
        date_classement = EXCLUDED.date_classement,
        manager_id = EXCLUDED.manager_id,
        points = EXCLUDED.points,
        updated_by_manager_id = EXCLUDED.updated_by_manager_id,
        updated_at = now();
    END IF;

    v_rows_inserted := v_rows_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'rows_inserted', v_rows_inserted
  );
END;
$$;