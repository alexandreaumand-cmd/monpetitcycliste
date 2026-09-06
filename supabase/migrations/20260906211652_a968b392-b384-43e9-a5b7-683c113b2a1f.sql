-- 1) Internal, reusable points computation (no admin gate; used by server-side flows)
CREATE OR REPLACE FUNCTION public.compute_points_for_course_internal(p_course_id text, p_actor_manager_id uuid DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_categorie text;
  v_course_phase_id uuid;
  v_course_saison_id uuid;
  v_rows_inserted int := 0;
  v_missing_bareme jsonb := '[]'::jsonb;
BEGIN
  SELECT c.categorie, c.phase_id, p.saison_id
  INTO v_course_categorie, v_course_phase_id, v_course_saison_id
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE c.id = p_course_id;

  IF v_course_categorie IS NULL THEN
    RAISE EXCEPTION 'Course not found: %', p_course_id;
  END IF;

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
      rrs.is_ttt,
      rrs.ttt_riders_count,
      COALESCE((
        SELECT
          CASE
            WHEN rrs.is_ttt = true
                 AND rrs.ttt_riders_count IS NOT NULL
                 AND rrs.ttt_riders_count > 0
                 AND j.position_decimal IS NOT NULL
            THEN ROUND(sr.points::numeric / rrs.ttt_riders_count, 2)
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
    LEFT JOIN LATERAL (
      SELECT rrs_inner.is_ttt, rrs_inner.ttt_riders_count
      FROM race_result_sets rrs_inner
      WHERE rrs_inner.course_id = j.course_id
        AND rrs_inner.type_classement = j.type_classement
        AND (rrs_inner.etape_numero = j.etape_numero OR (rrs_inner.etape_numero IS NULL AND j.etape_numero IS NULL))
      ORDER BY rrs_inner.created_at DESC
      LIMIT 1
    ) rrs ON true
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
    p_actor_manager_id,
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

REVOKE ALL ON FUNCTION public.compute_points_for_course_internal(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_points_for_course_internal(text, uuid) TO service_role;

-- 2) Admin entry point now delegates to the internal function
CREATE OR REPLACE FUNCTION public.admin_compute_points_for_course(p_course_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_manager_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  SELECT id INTO v_manager_id FROM managers WHERE user_id = auth.uid() LIMIT 1;

  RETURN public.compute_points_for_course_internal(p_course_id, v_manager_id);
END;
$function$;

-- 3) Saving a results batch now computes the points in the same server call
CREATE OR REPLACE FUNCTION public.admin_result_save_lot(p_course_id text, p_type_classement text, p_etape_numero integer, p_rows jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_saison_id uuid;
  v_date_debut date;
  v_date_fin date;
  v_stage_date date;
  v_auto_date date;
  v_type public.type_classement;
  v_rows_deleted int := 0;
  v_rows_inserted int := 0;
  v_manager_id uuid;
  v_compute json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  v_type := p_type_classement::public.type_classement;

  SELECT p.saison_id, c.date_debut, c.date_fin
  INTO v_saison_id, v_date_debut, v_date_fin
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE c.id = p_course_id;

  IF v_saison_id IS NULL THEN
    RAISE EXCEPTION 'Course not found or invalid: %', p_course_id;
  END IF;

  IF p_etape_numero IS NOT NULL THEN
    SELECT stage_date INTO v_stage_date
    FROM course_stage_config
    WHERE course_id = p_course_id AND etape_numero = p_etape_numero;
  END IF;

  v_auto_date := CASE
    WHEN p_etape_numero IS NOT NULL AND v_stage_date IS NOT NULL THEN
      v_stage_date
    WHEN p_etape_numero IS NOT NULL AND v_date_debut IS NOT NULL THEN
      (v_date_debut + (p_etape_numero - 1) * interval '1 day')::date
    ELSE
      COALESCE(v_date_fin, v_date_debut, CURRENT_DATE)
  END;

  DELETE FROM race_results
  WHERE course_id = p_course_id
    AND type_classement = v_type
    AND (
      (p_etape_numero IS NULL AND etape_numero IS NULL)
      OR (p_etape_numero IS NOT NULL AND etape_numero = p_etape_numero)
    );
  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  INSERT INTO race_results (
    course_id, saison_id, type_classement, etape_numero,
    coureur_id, position, position_decimal, points, statut, date_classement
  )
  SELECT
    p_course_id, v_saison_id, v_type, p_etape_numero,
    (row_data->>'coureur_id')::text,
    (row_data->>'position')::integer,
    (row_data->>'position_decimal')::numeric,
    COALESCE((row_data->>'points')::integer, 0),
    COALESCE((row_data->>'statut')::result_statut, 'finished'),
    COALESCE((row_data->>'date_classement')::date, v_auto_date)
  FROM jsonb_array_elements(p_rows) AS row_data
  WHERE (row_data->>'coureur_id') IS NOT NULL;
  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  SELECT id INTO v_manager_id FROM managers WHERE user_id = auth.uid() LIMIT 1;

  -- Compute the points right away so a failing client-side call can never leave
  -- results without points (which silently froze league standings).
  BEGIN
    v_compute := public.compute_points_for_course_internal(p_course_id, v_manager_id);
  EXCEPTION WHEN OTHERS THEN
    v_compute := json_build_object('success', false, 'error', SQLERRM);
  END;

  RETURN json_build_object(
    'success', true,
    'course_id', p_course_id,
    'type_classement', p_type_classement,
    'etape_numero', p_etape_numero,
    'rows_deleted', v_rows_deleted,
    'rows_inserted', v_rows_inserted,
    'compute', v_compute
  );
END;
$function$;

-- 4) Daily reconciliation: results without computed points get recomputed
CREATE OR REPLACE FUNCTION public.reconcile_missing_points(p_days integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_fixed text[] := '{}';
BEGIN
  FOR r IN
    SELECT DISTINCT rr.course_id
    FROM race_results rr
    JOIN courses c ON c.id = rr.course_id
    WHERE rr.statut = 'finished'
      AND (rr.position IS NOT NULL OR rr.position_decimal IS NOT NULL)
      AND (
        rr.type_classement = 'Etape'::type_classement
        OR rr.type_classement::text LIKE 'Porteur%'
        OR rr.etape_numero IS NULL
      )
      AND COALESCE(c.date_fin, c.date_debut) >= CURRENT_DATE - p_days
      AND NOT EXISTS (
        SELECT 1 FROM points_ledger pl
        WHERE pl.course_id = rr.course_id
          AND pl.type_classement = rr.type_classement
          AND COALESCE(pl.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
          AND pl.coureur_id = rr.coureur_id
      )
  LOOP
    BEGIN
      PERFORM public.compute_points_for_course_internal(r.course_id, NULL);
      v_fixed := v_fixed || r.course_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'reconcile_missing_points failed for %: %', r.course_id, SQLERRM;
    END;
  END LOOP;

  RETURN json_build_object('success', true, 'courses_recomputed', v_fixed);
END;
$function$;

REVOKE ALL ON FUNCTION public.reconcile_missing_points(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_missing_points(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_missing_points(integer) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-missing-points') THEN
    PERFORM cron.unschedule('reconcile-missing-points');
  END IF;
  PERFORM cron.schedule(
    'reconcile-missing-points',
    '15 3 * * *',
    $cron$ SELECT public.reconcile_missing_points(30); $cron$
  );
END $$;
