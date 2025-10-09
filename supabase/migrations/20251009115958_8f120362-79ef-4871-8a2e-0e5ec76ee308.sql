-- Modifier la contrainte unique de points_ledger pour ne pas inclure manager_id
-- Cela permet d'avoir une seule ligne par (course, type_classement, etape, coureur)
-- avec manager_id nullable

-- 1. Supprimer l'ancienne contrainte unique si elle existe
ALTER TABLE points_ledger DROP CONSTRAINT IF EXISTS points_ledger_course_id_type_classement_etape_numero_coureur_key;
ALTER TABLE points_ledger DROP CONSTRAINT IF EXISTS points_ledger_unique_entry;

-- 2. Créer la nouvelle contrainte unique sans manager_id
CREATE UNIQUE INDEX IF NOT EXISTS points_ledger_unique_result 
ON points_ledger (course_id, type_classement, COALESCE(etape_numero, -1), coureur_id);

-- 3. Modifier la fonction pour inclure TOUS les coureurs
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

  -- Vérifier les barèmes manquants
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

  -- Insérer TOUS les coureurs (avec ou sans manager)
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
    SELECT * FROM base
    WHERE statut = 'finished' 
      AND position IS NOT NULL
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
      e.position,
      co.categorie_norm,
      co.phase_id,
      co.id AS course_id,
      r.manager_id  -- Peut être NULL maintenant
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
        FROM scoring_rules_saisons sr
        WHERE sr.saison_id = v_course_saison_id
          AND LOWER(sr.categorie) = j.categorie_norm
          AND sr.type_classement = j.type_classement
          AND sr.place = j.position
        LIMIT 1
      ), 0) AS points
    FROM joined j
    -- PLUS DE FILTRE sur manager_id - on inclut TOUS les coureurs
  )
  INSERT INTO points_ledger
    (phase_id, course_id, manager_id, coureur_id, type_classement, etape_numero, points)
  SELECT
    s.phase_id, s.course_id, s.manager_id, s.coureur_id,
    s.type_classement, s.etape_numero, s.points
  FROM scored s
  -- Nouvelle contrainte sans manager_id
  ON CONFLICT ON CONSTRAINT points_ledger_unique_result
  DO UPDATE SET 
    points = EXCLUDED.points,
    manager_id = EXCLUDED.manager_id;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  -- Nettoyer les résultats qui n'existent plus
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