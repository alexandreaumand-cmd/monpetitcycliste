-- Index optimisations pour scoring_rules
CREATE INDEX IF NOT EXISTS idx_sr_cat_type_place
  ON scoring_rules(categorie, type_classement, place);

-- Index optimisations pour points_ledger
CREATE INDEX IF NOT EXISTS idx_pl_phase_manager ON points_ledger(phase_id, manager_id);
CREATE INDEX IF NOT EXISTS idx_pl_course ON points_ledger(course_id);

-- Fonction principale: calculer les points pour une course
CREATE OR REPLACE FUNCTION public.admin_compute_points_for_course(p_course_id text)
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
  v_missing_bareme jsonb := '[]'::jsonb;
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

  -- Detect missing scoring rules
  WITH joined AS (
    SELECT DISTINCT
      c.categorie,
      rr.type_classement,
      rr.position AS place
    FROM race_results rr
    JOIN courses c ON c.id = rr.course_id
    WHERE rr.course_id = p_course_id
      AND rr.statut = 'finished'
      AND rr.position IS NOT NULL
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'categorie', j.categorie,
      'type_classement', j.type_classement::text,
      'place', j.place
    )
  )
  INTO v_missing_bareme
  FROM joined j
  LEFT JOIN scoring_rules sr
    ON sr.categorie = j.categorie
   AND sr.type_classement = j.type_classement
   AND sr.place = j.place
  WHERE sr.points IS NULL;

  -- Upsert points into ledger
  WITH co AS (
    SELECT id, categorie, phase_id FROM courses WHERE id = p_course_id
  ),
  base AS (
    SELECT
      rr.type_classement,
      rr.etape_numero,
      rr.coureur_id,
      rr.position,
      rr.statut
    FROM race_results rr
    WHERE rr.course_id = p_course_id
  ),
  eligible AS (
    SELECT * FROM base
    WHERE statut = 'finished' AND position IS NOT NULL
  ),
  joined AS (
    SELECT
      e.type_classement,
      e.etape_numero,
      e.coureur_id,
      e.position,
      co.categorie,
      co.phase_id,
      co.id AS course_id,
      r.manager_id
    FROM eligible e
    CROSS JOIN co
    LEFT JOIN rosters r
      ON r.coureur_id = e.coureur_id
     AND r.phase_id = co.phase_id
  ),
  scored AS (
    SELECT
      j.*,
      COALESCE((
        SELECT sr.points
        FROM scoring_rules sr
        WHERE sr.categorie = j.categorie
          AND sr.type_classement = j.type_classement
          AND sr.place = j.position
        LIMIT 1
      ), 0) AS points
    FROM joined j
    WHERE j.manager_id IS NOT NULL
  )
  INSERT INTO points_ledger
    (phase_id, course_id, manager_id, coureur_id, type_classement, etape_numero, points)
  SELECT
    s.phase_id, s.course_id, s.manager_id, s.coureur_id,
    s.type_classement, s.etape_numero, s.points
  FROM scored s
  ON CONFLICT (course_id, type_classement, COALESCE(etape_numero,-1), coureur_id, manager_id)
  DO UPDATE SET points = EXCLUDED.points;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  -- Clean up obsolete ledger entries
  WITH co AS (
    SELECT id, phase_id FROM courses WHERE id = p_course_id
  ),
  eligible AS (
    SELECT
      rr.type_classement,
      rr.etape_numero,
      rr.coureur_id,
      rr.position
    FROM race_results rr
    WHERE rr.course_id = p_course_id
      AND rr.statut = 'finished'
      AND rr.position IS NOT NULL
  ),
  scored AS (
    SELECT
      e.type_classement,
      e.etape_numero,
      e.coureur_id,
      co.phase_id,
      co.id AS course_id,
      r.manager_id
    FROM eligible e
    CROSS JOIN co
    LEFT JOIN rosters r
      ON r.coureur_id = e.coureur_id
     AND r.phase_id = co.phase_id
    WHERE r.manager_id IS NOT NULL
  )
  DELETE FROM points_ledger pl
  USING co
  WHERE pl.course_id = co.id
    AND NOT EXISTS (
      SELECT 1 FROM scored s
      WHERE s.course_id = pl.course_id
        AND s.type_classement = pl.type_classement
        AND COALESCE(s.etape_numero,-1) = COALESCE(pl.etape_numero,-1)
        AND s.coureur_id = pl.coureur_id
        AND s.manager_id = pl.manager_id
    );

  -- Audit
  INSERT INTO audits (actor_manager_id, action, payload_json, created_at)
  VALUES (
    v_manager_id,
    'admin_compute_points_for_course',
    json_build_object(
      'course_id', p_course_id,
      'rows_upserted', v_rows_inserted,
      'missing_bareme', v_missing_bareme
    )::text,
    now()
  );

  RETURN json_build_object(
    'success', true,
    'course_id', p_course_id,
    'rows_upserted', v_rows_inserted,
    'missing_bareme', COALESCE(v_missing_bareme, '[]'::jsonb)
  );
END;
$$;

-- Fonction: recalculer tous les points d'une phase
CREATE OR REPLACE FUNCTION public.admin_recompute_points_for_phase(p_phase_id uuid)
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

-- Fonction: résumé des points d'une course
CREATE OR REPLACE FUNCTION public.course_points_summary(p_course_id text, p_manager_id uuid DEFAULT NULL)
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