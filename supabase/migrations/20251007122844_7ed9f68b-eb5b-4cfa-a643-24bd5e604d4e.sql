-- Fix admin_compute_points_for_course to award points only once per classification type
CREATE OR REPLACE FUNCTION public.admin_compute_points_for_course(p_course_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_course_categorie text;
  v_course_phase_id uuid;
  v_manager_id uuid;
  v_rows_inserted int := 0;
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

  -- Detect missing scoring rules (with normalized category)
  WITH joined AS (
    SELECT DISTINCT
      LOWER(c.categorie) AS categorie_norm,
      rr.type_classement,
      rr.position AS place
    FROM race_results rr
    JOIN courses c ON c.id = rr.course_id
    WHERE rr.course_id = p_course_id
      AND rr.statut = 'finished'
      AND rr.position IS NOT NULL
      -- Only count final classifications for non-Etape types
      AND (
        rr.type_classement = 'Etape'::type_classement
        OR rr.etape_numero IS NULL
      )
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'categorie', j.categorie_norm,
      'type_classement', j.type_classement::text,
      'place', j.place
    )
  )
  INTO v_missing_bareme
  FROM joined j
  LEFT JOIN scoring_rules sr
    ON LOWER(sr.categorie) = j.categorie_norm
   AND sr.type_classement = j.type_classement
   AND sr.place = j.place
  WHERE sr.points IS NULL;

  -- Upsert points into ledger (with normalized category)
  WITH co AS (
    SELECT id, LOWER(categorie) AS categorie_norm, phase_id FROM courses WHERE id = p_course_id
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
    -- Only include finished results with positions
    -- For 'Etape' type: include all stages
    -- For other types (General, Points, Montagne, Jeune): ONLY final classification (etape_numero IS NULL)
    SELECT * FROM base
    WHERE statut = 'finished' 
      AND position IS NOT NULL
      AND (
        type_classement = 'Etape'::type_classement
        OR etape_numero IS NULL
      )
  ),
  joined AS (
    SELECT
      e.type_classement,
      e.etape_numero,
      e.coureur_id,
      e.position,
      co.categorie_norm,
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
        WHERE LOWER(sr.categorie) = j.categorie_norm
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
      AND (
        rr.type_classement = 'Etape'::type_classement
        OR rr.etape_numero IS NULL
      )
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
$function$;

-- Clean up duplicate points in points_ledger for non-Etape classifications
-- Keep only final classifications (etape_numero IS NULL) for General, Points, Montagne, Jeune
DELETE FROM points_ledger
WHERE type_classement <> 'Etape'::type_classement
  AND etape_numero IS NOT NULL;