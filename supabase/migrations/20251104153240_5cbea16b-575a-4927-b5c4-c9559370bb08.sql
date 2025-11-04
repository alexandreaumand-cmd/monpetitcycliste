-- Modifier admin_compute_points_for_course pour utiliser course_stage_config
CREATE OR REPLACE FUNCTION public.admin_compute_points_for_course(p_course_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_course_categorie text;
  v_course_phase_id uuid;
  v_course_saison_id uuid;
  v_manager_id uuid;
  v_rows_inserted int := 0;
  v_missing_bareme jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  SELECT id INTO v_manager_id FROM managers WHERE user_id = auth.uid() LIMIT 1;

  SELECT c.categorie, c.phase_id, p.saison_id
  INTO v_course_categorie, v_course_phase_id, v_course_saison_id
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE c.id = p_course_id;

  IF v_course_categorie IS NULL THEN
    RAISE EXCEPTION 'Course not found: %', p_course_id;
  END IF;

  -- Find missing baremes using COALESCE for position
  WITH joined AS (
    SELECT DISTINCT
      LOWER(c.categorie) AS categorie_norm,
      rr.type_classement,
      COALESCE(rr.position, FLOOR(rr.position_decimal)) AS place
    FROM race_results rr
    JOIN courses c ON c.id = rr.course_id
    WHERE rr.course_id = p_course_id
      AND rr.statut = 'finished'
      AND (rr.position IS NOT NULL OR rr.position_decimal IS NOT NULL)
      AND (
        rr.type_classement = 'Etape'::type_classement
        OR rr.type_classement::text LIKE 'Porteur%'
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
  LEFT JOIN scoring_rules_saisons sr
    ON sr.saison_id = v_course_saison_id
   AND LOWER(sr.categorie) = j.categorie_norm
   AND sr.type_classement = j.type_classement
   AND sr.place = j.place
  WHERE sr.points IS NULL;

  -- Upsert points using COALESCE for position and TTT division logic from course_stage_config
  WITH co AS (
    SELECT id, LOWER(categorie) AS categorie_norm, phase_id FROM courses WHERE id = p_course_id
  ),
  base AS (
    SELECT
      rr.type_classement,
      rr.etape_numero,
      rr.coureur_id,
      rr.position,
      rr.position_decimal,
      rr.statut
    FROM race_results rr
    WHERE rr.course_id = p_course_id
  ),
  eligible AS (
    SELECT * FROM base
    WHERE statut = 'finished' 
      AND (position IS NOT NULL OR position_decimal IS NOT NULL)
      AND (
        type_classement = 'Etape'::type_classement
        OR type_classement::text LIKE 'Porteur%'
        OR etape_numero IS NULL
      )
  ),
  joined AS (
    SELECT
      e.type_classement,
      e.etape_numero,
      e.coureur_id,
      COALESCE(e.position, FLOOR(e.position_decimal)) AS position,
      e.position_decimal,
      co.categorie_norm,
      co.phase_id,
      co.id AS course_id
    FROM eligible e
    CROSS JOIN co
  ),
  scored AS (
    SELECT
      j.*,
      csc.ttt_riders_per_team,
      COALESCE((
        SELECT 
          CASE 
            WHEN csc.ttt_riders_per_team IS NOT NULL 
                 AND csc.ttt_riders_per_team > 0 
                 AND j.position_decimal IS NOT NULL
            THEN FLOOR(sr.points / csc.ttt_riders_per_team)
            ELSE sr.points
          END
        FROM scoring_rules_saisons sr
        WHERE sr.saison_id = v_course_saison_id
          AND LOWER(sr.categorie) = j.categorie_norm
          AND sr.type_classement = j.type_classement
          AND sr.place = j.position
        LIMIT 1
      ), 0) AS points
    FROM joined j
    LEFT JOIN course_stage_config csc 
      ON csc.course_id = j.course_id 
      AND csc.etape_numero = j.etape_numero
  )
  INSERT INTO points_ledger
    (phase_id, course_id, coureur_id, type_classement, etape_numero, points)
  SELECT
    s.phase_id, s.course_id, s.coureur_id,
    s.type_classement, s.etape_numero, s.points
  FROM scored s
  ON CONFLICT (course_id, type_classement, coureur_id, COALESCE(etape_numero, -1))
  DO UPDATE SET 
    points = EXCLUDED.points;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  -- Clean up points for riders no longer in results
  WITH co AS (
    SELECT id, phase_id FROM courses WHERE id = p_course_id
  ),
  eligible AS (
    SELECT
      rr.type_classement,
      rr.etape_numero,
      rr.coureur_id,
      COALESCE(rr.position, FLOOR(rr.position_decimal)) AS position
    FROM race_results rr
    WHERE rr.course_id = p_course_id
      AND rr.statut = 'finished'
      AND (rr.position IS NOT NULL OR rr.position_decimal IS NOT NULL)
      AND (
        rr.type_classement = 'Etape'::type_classement
        OR rr.type_classement::text LIKE 'Porteur%'
        OR rr.etape_numero IS NULL
      )
  ),
  scored AS (
    SELECT
      e.type_classement,
      e.etape_numero,
      e.coureur_id,
      co.phase_id,
      co.id AS course_id
    FROM eligible e
    CROSS JOIN co
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
    );

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