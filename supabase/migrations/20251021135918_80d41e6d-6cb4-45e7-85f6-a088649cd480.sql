-- ================================================
-- REFACTORISATION POINTS_LEDGER : Modèle Global
-- ================================================

-- ==================================================
-- ÉTAPE 1 : Supprimer les vues dépendantes
-- ==================================================

DROP VIEW IF EXISTS v_recent_points CASCADE;
DROP VIEW IF EXISTS v_manager_standings_by_phase CASCADE;
DROP VIEW IF EXISTS v_manager_standings_total CASCADE;
DROP VIEW IF EXISTS v_manager_standings_by_season CASCADE;
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2 CASCADE;
DROP VIEW IF EXISTS v_manager_standings_by_season_v2 CASCADE;
DROP VIEW IF EXISTS v_manager_breakdown CASCADE;

-- ==================================================
-- ÉTAPE 2 : Supprimer la politique RLS dépendante
-- ==================================================

DROP POLICY IF EXISTS game_write_points ON public.points_ledger;

-- ==================================================
-- ÉTAPE 3 : Supprimer les colonnes de points_ledger
-- ==================================================

ALTER TABLE public.points_ledger 
  DROP COLUMN IF EXISTS manager_id,
  DROP COLUMN IF EXISTS league_id;

-- ==================================================
-- ÉTAPE 4 : Supprimer les index obsolètes
-- ==================================================

DROP INDEX IF EXISTS idx_points_ledger_phase_manager;
DROP INDEX IF EXISTS idx_points_ledger_manager;
DROP INDEX IF EXISTS idx_points_ledger_league;
DROP INDEX IF EXISTS idx_points_ledger_league_phase;
DROP INDEX IF EXISTS idx_points_ledger_league_course;

-- ==================================================
-- ÉTAPE 5 : Créer de nouveaux index optimisés
-- ==================================================

CREATE INDEX IF NOT EXISTS idx_points_ledger_phase_coureur 
  ON public.points_ledger(phase_id, coureur_id);

CREATE INDEX IF NOT EXISTS idx_points_ledger_course_type 
  ON public.points_ledger(course_id, type_classement, etape_numero);

-- ==================================================
-- ÉTAPE 6 : Recréer v_manager_breakdown (avec JOIN rosters)
-- ==================================================

CREATE OR REPLACE VIEW v_manager_breakdown AS
SELECT
  r.manager_id,
  r.league_id,
  pl.phase_id,
  pl.course_id,
  pl.coureur_id,
  pl.type_classement,
  pl.etape_numero,
  pl.points,
  m.nom AS manager_nom,
  c.nom AS course_nom,
  c.date_debut,
  c.date_fin,
  co.nom AS coureur_nom
FROM points_ledger pl
JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
JOIN managers m ON m.id = r.manager_id
JOIN courses c ON c.id = pl.course_id
JOIN coureurs co ON co.id = pl.coureur_id;

-- ==================================================
-- ÉTAPE 7 : Mettre à jour admin_compute_points_for_course
-- ==================================================

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
      co.id AS course_id
    FROM eligible e
    CROSS JOIN co
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

-- ==================================================
-- ÉTAPE 8 : Mettre à jour trigger_calculate_bonus_rider
-- ==================================================

CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bonus_record RECORD;
  v_bonus_amount INTEGER;
  v_saison_id uuid;
  v_cote_initiale NUMERIC;
BEGIN
  IF NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT p.saison_id INTO v_saison_id
  FROM phases p
  WHERE p.id = NEW.phase_id;

  FOR v_bonus_record IN
    SELECT 
      r.manager_id,
      r.league_id,
      brs.coureur_id IS NOT NULL AS is_bonus_rider
    FROM rosters r
    LEFT JOIN bonus_rider_selections brs 
      ON brs.manager_id = r.manager_id 
      AND brs.phase_id = r.phase_id 
      AND brs.coureur_id = r.coureur_id
    WHERE r.coureur_id = NEW.coureur_id
      AND r.phase_id = NEW.phase_id
  LOOP
    IF v_bonus_record.is_bonus_rider THEN
      SELECT prix_initial INTO v_cote_initiale
      FROM coureurs_saisons
      WHERE coureur_id = NEW.coureur_id AND saison_id = v_saison_id;
      
      IF v_cote_initiale IS NULL THEN
        SELECT prix_initial INTO v_cote_initiale FROM coureurs WHERE id = NEW.coureur_id;
      END IF;
      
      IF v_cote_initiale IN (10, 20) THEN
        v_bonus_amount := FLOOR(NEW.points * 0.25);
        
        INSERT INTO bonus_points (
          phase_id, coureur_id, manager_id, bonus_type, points,
          commentaire, created_by, league_id
        ) VALUES (
          NEW.phase_id, NEW.coureur_id, v_bonus_record.manager_id,
          'coureur_bonuse', v_bonus_amount,
          'Bonus coureur automatique (25%) - ' || COALESCE(NEW.course_id, 'Course') || ' - ' || NEW.type_classement::text,
          v_bonus_record.manager_id,
          v_bonus_record.league_id
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ==================================================
-- ÉTAPE 9 : Mettre à jour calculate_retroactive_bonus_after_selection
-- ==================================================

CREATE OR REPLACE FUNCTION public.calculate_retroactive_bonus_after_selection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_points_record RECORD;
  v_bonus_amount INTEGER;
  v_saison_id uuid;
  v_cote_initiale NUMERIC;
  v_league_id uuid;
BEGIN
  SELECT p.saison_id INTO v_saison_id
  FROM phases p
  WHERE p.id = NEW.phase_id;

  SELECT r.league_id INTO v_league_id
  FROM rosters r
  WHERE r.manager_id = NEW.manager_id
    AND r.phase_id = NEW.phase_id
  LIMIT 1;

  SELECT prix_initial INTO v_cote_initiale
  FROM coureurs_saisons
  WHERE coureur_id = NEW.coureur_id
    AND saison_id = v_saison_id;
  
  IF v_cote_initiale IS NULL THEN
    SELECT prix_initial INTO v_cote_initiale
    FROM coureurs
    WHERE id = NEW.coureur_id;
  END IF;
  
  IF v_cote_initiale IS NULL OR (v_cote_initiale != 10 AND v_cote_initiale != 20) THEN
    RETURN NEW;
  END IF;

  FOR v_points_record IN
    SELECT 
      pl.phase_id,
      pl.course_id,
      pl.coureur_id,
      pl.type_classement,
      pl.points
    FROM points_ledger pl
    WHERE pl.coureur_id = NEW.coureur_id
      AND pl.phase_id = NEW.phase_id
      AND pl.points > 0
  LOOP
    v_bonus_amount := FLOOR(v_points_record.points * 0.25);
    
    INSERT INTO bonus_points (
      phase_id,
      coureur_id,
      manager_id,
      target_manager_id,
      bonus_type,
      points,
      commentaire,
      created_by,
      league_id
    ) VALUES (
      v_points_record.phase_id,
      v_points_record.coureur_id,
      NEW.manager_id,
      NULL,
      'coureur_bonuse',
      v_bonus_amount,
      'Bonus coureur rétroactif (25%) - ' || COALESCE(v_points_record.course_id, 'Course') || ' - ' || v_points_record.type_classement::text,
      NEW.manager_id,
      v_league_id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;