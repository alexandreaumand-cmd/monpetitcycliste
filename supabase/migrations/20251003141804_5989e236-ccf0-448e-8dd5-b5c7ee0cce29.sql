-- Create unique index for points_ledger to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_scope
ON points_ledger(course_id, type_classement, COALESCE(etape_numero,-1), coureur_id, manager_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_points_ledger_course 
ON points_ledger(course_id);

CREATE INDEX IF NOT EXISTS idx_points_ledger_phase_manager 
ON points_ledger(phase_id, manager_id);

-- Function to compute points for a specific course
CREATE OR REPLACE FUNCTION admin_compute_points_for_course(p_course_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_categorie text;
  v_course_phase_id uuid;
  v_manager_id uuid;
  v_type_classement type_classement;
  v_etape_numero int;
  v_rows_inserted int := 0;
  v_rows_updated int := 0;
  v_types_processed text[] := ARRAY[]::text[];
BEGIN
  -- Check admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  -- Get manager ID for audit
  SELECT id INTO v_manager_id FROM managers WHERE user_id = auth.uid() LIMIT 1;

  -- Get course info
  SELECT categorie, phase_id 
  INTO v_course_categorie, v_course_phase_id
  FROM courses 
  WHERE id = p_course_id;

  IF v_course_categorie IS NULL THEN
    RAISE EXCEPTION 'Course not found: %', p_course_id;
  END IF;

  -- Delete existing points for this course
  DELETE FROM points_ledger WHERE course_id = p_course_id;

  -- Get all type_classement for this course
  FOR v_type_classement IN 
    SELECT DISTINCT type_classement 
    FROM race_results 
    WHERE course_id = p_course_id
  LOOP
    v_types_processed := array_append(v_types_processed, v_type_classement::text);

    IF v_type_classement = 'Etape' THEN
      -- Process each etape separately
      FOR v_etape_numero IN
        SELECT DISTINCT etape_numero
        FROM race_results
        WHERE course_id = p_course_id 
          AND type_classement = 'Etape'
          AND etape_numero IS NOT NULL
        ORDER BY etape_numero
      LOOP
        -- Insert points for this etape
        INSERT INTO points_ledger (
          phase_id, course_id, manager_id, coureur_id,
          type_classement, etape_numero, points
        )
        SELECT
          v_course_phase_id,
          p_course_id,
          r.manager_id,
          rr.coureur_id,
          v_type_classement,
          v_etape_numero,
          CASE
            WHEN rr.statut = 'finished' AND rr.position IS NOT NULL THEN
              COALESCE((
                SELECT sr.points
                FROM scoring_rules sr
                WHERE sr.categorie = v_course_categorie
                  AND sr.type_classement = v_type_classement
                  AND sr.place = rr.position
                LIMIT 1
              ), 0)
            ELSE 0
          END AS points
        FROM race_results rr
        LEFT JOIN rosters r 
          ON r.coureur_id = rr.coureur_id 
          AND r.phase_id = v_course_phase_id
        WHERE rr.course_id = p_course_id
          AND rr.type_classement = v_type_classement
          AND rr.etape_numero = v_etape_numero
          AND r.manager_id IS NOT NULL  -- Only for riders with a manager
        ON CONFLICT (course_id, type_classement, COALESCE(etape_numero,-1), coureur_id, manager_id)
        DO UPDATE SET points = EXCLUDED.points;
        
        GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
      END LOOP;
    ELSE
      -- Process non-etape type (General, Points, Montagne, Jeune)
      INSERT INTO points_ledger (
        phase_id, course_id, manager_id, coureur_id,
        type_classement, etape_numero, points
      )
      SELECT
        v_course_phase_id,
        p_course_id,
        r.manager_id,
        rr.coureur_id,
        v_type_classement,
        NULL,
        CASE
          WHEN rr.statut = 'finished' AND rr.position IS NOT NULL THEN
            COALESCE((
              SELECT sr.points
              FROM scoring_rules sr
              WHERE sr.categorie = v_course_categorie
                AND sr.type_classement = v_type_classement
                AND sr.place = rr.position
              LIMIT 1
            ), 0)
          ELSE 0
        END AS points
      FROM race_results rr
      LEFT JOIN rosters r 
        ON r.coureur_id = rr.coureur_id 
        AND r.phase_id = v_course_phase_id
      WHERE rr.course_id = p_course_id
        AND rr.type_classement = v_type_classement
        AND r.manager_id IS NOT NULL  -- Only for riders with a manager
      ON CONFLICT (course_id, type_classement, COALESCE(etape_numero,-1), coureur_id, manager_id)
      DO UPDATE SET points = EXCLUDED.points;
      
      GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
    END IF;
  END LOOP;

  -- Count total rows
  SELECT COUNT(*) INTO v_rows_inserted 
  FROM points_ledger 
  WHERE course_id = p_course_id;

  -- Audit
  INSERT INTO audits (actor_manager_id, action, payload_json, created_at)
  VALUES (
    v_manager_id,
    'admin_compute_points_for_course',
    json_build_object(
      'course_id', p_course_id,
      'types_processed', v_types_processed,
      'total_rows', v_rows_inserted
    )::text,
    now()
  );

  RETURN json_build_object(
    'success', true,
    'course_id', p_course_id,
    'types_processed', v_types_processed,
    'total_rows', v_rows_inserted
  );
END;
$$;

-- Function to recompute points for an entire phase
CREATE OR REPLACE FUNCTION admin_recompute_points_for_phase(p_phase_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id text;
  v_courses_processed int := 0;
  v_total_rows int := 0;
BEGIN
  -- Check admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  -- Process each course in the phase
  FOR v_course_id IN 
    SELECT id FROM courses WHERE phase_id = p_phase_id
  LOOP
    PERFORM admin_compute_points_for_course(v_course_id);
    v_courses_processed := v_courses_processed + 1;
  END LOOP;

  -- Count total points
  SELECT COUNT(*) INTO v_total_rows
  FROM points_ledger
  WHERE phase_id = p_phase_id;

  RETURN json_build_object(
    'success', true,
    'phase_id', p_phase_id,
    'courses_processed', v_courses_processed,
    'total_rows', v_total_rows
  );
END;
$$;

-- Function to get course points summary
CREATE OR REPLACE FUNCTION course_points_summary(p_course_id text, p_manager_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_points', COALESCE(SUM(points), 0),
    'my_points', COALESCE(SUM(points) FILTER (WHERE manager_id = COALESCE(p_manager_id, (
      SELECT id FROM managers WHERE user_id = auth.uid() LIMIT 1
    ))), 0)
  )
  FROM points_ledger
  WHERE course_id = p_course_id;
$$;