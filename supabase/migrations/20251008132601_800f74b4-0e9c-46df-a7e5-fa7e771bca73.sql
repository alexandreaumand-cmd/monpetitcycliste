-- Migration: Ajout de saison_id aux tables de résultats
-- Étape 1: Ajouter les colonnes saison_id (nullable initialement)
ALTER TABLE race_results ADD COLUMN IF NOT EXISTS saison_id uuid;
ALTER TABLE race_result_sets ADD COLUMN IF NOT EXISTS saison_id uuid;

-- Étape 2: Peupler saison_id à partir des courses existantes
UPDATE race_results rr
SET saison_id = p.saison_id
FROM courses c
JOIN phases p ON p.id = c.phase_id
WHERE rr.course_id = c.id AND rr.saison_id IS NULL;

UPDATE race_result_sets rrs
SET saison_id = p.saison_id
FROM courses c
JOIN phases p ON p.id = c.phase_id
WHERE rrs.course_id = c.id AND rrs.saison_id IS NULL;

-- Étape 3: Rendre saison_id NOT NULL
ALTER TABLE race_results ALTER COLUMN saison_id SET NOT NULL;
ALTER TABLE race_result_sets ALTER COLUMN saison_id SET NOT NULL;

-- Étape 4: Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_race_results_course_saison ON race_results(course_id, saison_id);
CREATE INDEX IF NOT EXISTS idx_race_result_sets_course_saison ON race_result_sets(course_id, saison_id);

-- Étape 5: Mise à jour de admin_result_save_lot pour gérer saison_id
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

  -- Get or create result_set avec saison_id
  SELECT id INTO v_result_set_id
  FROM race_result_sets
  WHERE course_id = p_course_id
    AND type_classement = p_type_classement
    AND saison_id = v_saison_id
    AND (
      (p_type_classement = 'Etape' AND etape_numero = p_etape_numero)
      OR (p_type_classement != 'Etape' AND etape_numero IS NULL)
    );

  IF v_result_set_id IS NULL THEN
    INSERT INTO race_result_sets (course_id, type_classement, etape_numero, created_by, saison_id)
    VALUES (p_course_id, p_type_classement, p_etape_numero, v_manager_id, v_saison_id)
    RETURNING id INTO v_result_set_id;
  END IF;

  SELECT COALESCE(date_fin, date_debut) 
  INTO v_date_classement
  FROM courses WHERE id = p_course_id;

  -- Delete existing results for this classification
  DELETE FROM race_results
  WHERE course_id = p_course_id
    AND type_classement = p_type_classement
    AND saison_id = v_saison_id
    AND (
      (p_type_classement = 'Etape'::type_classement AND etape_numero = p_etape_numero)
      OR (p_type_classement <> 'Etape'::type_classement AND etape_numero IS NULL)
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

-- Étape 6: Mise à jour de results_courses_with_entries pour filtrer directement sur saison_id
CREATE OR REPLACE FUNCTION public.results_courses_with_entries(p_search text DEFAULT NULL, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_phase_id uuid DEFAULT NULL, p_saison_id uuid DEFAULT NULL)
RETURNS TABLE(course_id text, nom text, categorie text, date_debut date, date_fin date, last_result_at date, types text[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH rr AS (
  SELECT course_id, MAX(date_classement) AS last_result_at
  FROM race_results
  WHERE (p_saison_id IS NULL OR saison_id = p_saison_id)
  GROUP BY course_id
),
types AS (
  SELECT course_id, ARRAY_AGG(DISTINCT type_classement::text) AS types
  FROM race_results
  WHERE (p_saison_id IS NULL OR saison_id = p_saison_id)
  GROUP BY course_id
),
base AS (
  SELECT c.id AS course_id, c.nom, c.categorie, c.date_debut, c.date_fin, rr.last_result_at
  FROM rr
  JOIN courses c ON c.id = rr.course_id
  WHERE (p_search IS NULL OR c.nom ILIKE '%' || p_search || '%')
    AND (p_phase_id IS NULL OR c.phase_id = p_phase_id)
    AND (p_saison_id IS NULL OR c.phase_id IN (
      SELECT p.id FROM phases p WHERE p.saison_id = p_saison_id
    ))
)
SELECT
  b.course_id, b.nom, b.categorie, b.date_debut, b.date_fin,
  b.last_result_at,
  COALESCE(t.types, ARRAY[]::text[]) AS types
FROM base b
LEFT JOIN types t ON t.course_id = b.course_id
ORDER BY b.last_result_at DESC NULLS LAST, b.date_fin DESC NULLS LAST
LIMIT COALESCE(p_limit, 24)
OFFSET COALESCE(p_offset, 0);
$function$;