-- Corriger la fonction admin_result_save_lot pour gérer correctement les porteurs de maillots d'étape
CREATE OR REPLACE FUNCTION public.admin_result_save_lot(p_course_id text, p_type_classement type_classement, p_etape_numero integer, p_rows jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_manager_id uuid;
  v_result_set_id uuid;
  v_row jsonb;
  v_date_classement date;
  v_saison_id uuid;
  v_total_rows int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  SELECT id INTO v_manager_id FROM managers WHERE user_id = auth.uid() LIMIT 1;

  -- Récupérer saison_id depuis la course
  SELECT p.saison_id INTO v_saison_id
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE c.id = p_course_id;

  IF v_saison_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de déterminer la saison pour la course %', p_course_id;
  END IF;

  -- CORRECTION: Utiliser une logique simple basée sur p_etape_numero
  SELECT id INTO v_result_set_id
  FROM race_result_sets
  WHERE course_id = p_course_id
    AND type_classement = p_type_classement
    AND saison_id = v_saison_id
    AND (
      (p_etape_numero IS NOT NULL AND etape_numero = p_etape_numero)
      OR
      (p_etape_numero IS NULL AND etape_numero IS NULL)
    );

  IF v_result_set_id IS NULL THEN
    INSERT INTO race_result_sets (course_id, type_classement, etape_numero, created_by, saison_id)
    VALUES (p_course_id, p_type_classement, p_etape_numero, v_manager_id, v_saison_id)
    RETURNING id INTO v_result_set_id;
  END IF;

  -- Calculer la date_classement en fonction du type et de l'étape
  SELECT 
    CASE
      WHEN p_etape_numero IS NOT NULL THEN 
        (date_debut + (p_etape_numero - 1) * INTERVAL '1 day')::date
      ELSE 
        COALESCE(date_fin, date_debut)
    END
  INTO v_date_classement
  FROM courses 
  WHERE id = p_course_id;

  -- CORRECTION: Même logique simplifiée pour DELETE
  DELETE FROM race_results
  WHERE course_id = p_course_id
    AND type_classement = p_type_classement
    AND saison_id = v_saison_id
    AND (
      (p_etape_numero IS NOT NULL AND etape_numero = p_etape_numero)
      OR
      (p_etape_numero IS NULL AND etape_numero IS NULL)
    );

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO race_results (
      result_set_id, course_id, type_classement, etape_numero,
      coureur_id, position, statut, date_classement,
      updated_by_manager_id, saison_id
    )
    VALUES (
      v_result_set_id, p_course_id, p_type_classement, p_etape_numero,
      (v_row->>'coureur_id')::text, (v_row->>'position')::int,
      (v_row->>'statut')::result_statut, v_date_classement,
      v_manager_id, v_saison_id
    )
    ON CONFLICT (course_id, type_classement, COALESCE(etape_numero, -1), position)
    DO UPDATE SET
      coureur_id = EXCLUDED.coureur_id,
      statut = EXCLUDED.statut,
      result_set_id = EXCLUDED.result_set_id,
      date_classement = EXCLUDED.date_classement,
      updated_by_manager_id = EXCLUDED.updated_by_manager_id,
      saison_id = EXCLUDED.saison_id,
      updated_at = now()
    WHERE race_results.coureur_id IS DISTINCT FROM EXCLUDED.coureur_id
       OR race_results.statut IS DISTINCT FROM EXCLUDED.statut
       OR race_results.date_classement IS DISTINCT FROM EXCLUDED.date_classement
       OR race_results.saison_id IS DISTINCT FROM EXCLUDED.saison_id;

    v_total_rows := v_total_rows + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'result_set_id', v_result_set_id,
    'rows_affected', v_total_rows
  );
END;
$function$;