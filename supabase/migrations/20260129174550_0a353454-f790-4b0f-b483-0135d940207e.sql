-- Migration: Points décimaux pour TTT + Fonction helper bonus scoreurs
-- ÉTAPE 1: Supprimer toutes les vues dépendantes de points_ledger.points

DROP VIEW IF EXISTS v_manager_breakdown CASCADE;
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2 CASCADE;
DROP VIEW IF EXISTS v_manager_standings_by_season_v2 CASCADE;
DROP VIEW IF EXISTS v_manager_standings_total CASCADE;
DROP VIEW IF EXISTS v_top_riders_by_phase CASCADE;
DROP VIEW IF EXISTS v_top_riders_by_season CASCADE;
DROP VIEW IF EXISTS v_top_riders_global CASCADE;

-- Supprimer la fonction results_course_table car le type de retour change
DROP FUNCTION IF EXISTS public.results_course_table(text, type_classement, integer, uuid, uuid);

-- ÉTAPE 2: Modifier le type de colonne points_ledger.points

ALTER TABLE public.points_ledger 
  ALTER COLUMN points TYPE NUMERIC(10,2) USING points::NUMERIC(10,2);

COMMENT ON COLUMN public.points_ledger.points IS 
  'Points attribués au coureur. Peut contenir 2 décimales pour les résultats TTT.';

-- ÉTAPE 3: Recréer toutes les vues avec le nouveau type

-- v_manager_breakdown
CREATE VIEW v_manager_breakdown AS
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
JOIN coureurs co ON co.id = pl.coureur_id
JOIN phases p ON p.id = pl.phase_id
JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id;

-- v_manager_standings_by_phase_v2
CREATE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT
    r.manager_id,
    r.league_id,
    r.phase_id,
    sum(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  GROUP BY r.manager_id, r.league_id, r.phase_id
),
manager_bonus_pts AS (
  SELECT
    manager_id,
    league_id,
    phase_id,
    sum(bonus_itt + bonus_ttt + bonus_first_win + bonus_coureurs + bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points
  GROUP BY manager_id, league_id, phase_id
),
rider_bonus_pts AS (
  SELECT
    COALESCE(manager_id, target_manager_id) AS manager_id,
    league_id,
    phase_id,
    sum(points) AS rider_bonus
  FROM bonus_points
  GROUP BY COALESCE(manager_id, target_manager_id), league_id, phase_id
),
scoreurs AS (
  SELECT
    r.manager_id,
    r.league_id,
    r.phase_id,
    count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, r.phase_id
),
victories AS (
  SELECT
    r.manager_id,
    r.league_id,
    r.phase_id,
    count(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE rr.position = 1 
    AND rr.statut = 'finished'
    AND rr.type_classement IN ('Etape', 'General')
    AND NOT EXISTS (
      SELECT 1 FROM race_results rr2
      WHERE rr2.course_id = rr.course_id 
        AND rr2.type_classement = rr.type_classement 
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2.position = 1 
        AND rr2.statut = 'finished'
      GROUP BY rr2.course_id, rr2.type_classement, COALESCE(rr2.etape_numero, -1)
      HAVING count(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, r.phase_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, sc.phase_id, v.phase_id) AS phase_id,
  COALESCE(rp.total_race_pts, 0)::numeric AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0)::bigint AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0)::bigint AS rider_bonus,
  (COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0))::numeric AS total_points,
  COALESCE(sc.nb_scoreurs, 0)::bigint AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0)::bigint AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
FULL JOIN manager_bonus_pts mbp USING (manager_id, league_id, phase_id)
FULL JOIN rider_bonus_pts rbp USING (manager_id, league_id, phase_id)
FULL JOIN scoreurs sc USING (manager_id, league_id, phase_id)
FULL JOIN victories v USING (manager_id, league_id, phase_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

-- v_manager_standings_by_season_v2
CREATE VIEW v_manager_standings_by_season_v2 AS
WITH race_pts AS (
  SELECT
    r.manager_id,
    r.league_id,
    p.saison_id,
    sum(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  GROUP BY r.manager_id, r.league_id, p.saison_id
),
manager_bonus_pts AS (
  SELECT
    mbp.manager_id,
    mbp.league_id,
    p.saison_id,
    sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN phases p ON p.id = mbp.phase_id
  GROUP BY mbp.manager_id, mbp.league_id, p.saison_id
),
rider_bonus_pts AS (
  SELECT
    COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
    bp.league_id,
    p.saison_id,
    sum(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN phases p ON p.id = bp.phase_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, p.saison_id
),
scoreurs AS (
  SELECT
    r.manager_id,
    r.league_id,
    p.saison_id,
    count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, p.saison_id
),
victories AS (
  SELECT
    r.manager_id,
    r.league_id,
    p.saison_id,
    count(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE rr.position = 1 
    AND rr.statut = 'finished'
    AND rr.type_classement IN ('Etape', 'General')
    AND NOT EXISTS (
      SELECT 1 FROM race_results rr2
      WHERE rr2.course_id = rr.course_id 
        AND rr2.type_classement = rr.type_classement 
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2.position = 1 
        AND rr2.statut = 'finished'
      GROUP BY rr2.course_id, rr2.type_classement, COALESCE(rr2.etape_numero, -1)
      HAVING count(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, p.saison_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, sc.saison_id, v.saison_id) AS saison_id,
  COALESCE(rp.total_race_pts, 0)::numeric AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0)::bigint AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0)::bigint AS rider_bonus,
  (COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0))::numeric AS total_points,
  COALESCE(sc.nb_scoreurs, 0)::bigint AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0)::bigint AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
FULL JOIN manager_bonus_pts mbp USING (manager_id, league_id, saison_id)
FULL JOIN rider_bonus_pts rbp USING (manager_id, league_id, saison_id)
FULL JOIN scoreurs sc USING (manager_id, league_id, saison_id)
FULL JOIN victories v USING (manager_id, league_id, saison_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

-- v_manager_standings_total
CREATE VIEW v_manager_standings_total AS
WITH race_pts AS (
  SELECT
    r.manager_id,
    r.league_id,
    sum(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  GROUP BY r.manager_id, r.league_id
),
manager_bonus_pts AS (
  SELECT
    manager_id,
    league_id,
    sum(bonus_itt + bonus_ttt + bonus_first_win + bonus_coureurs + bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points
  GROUP BY manager_id, league_id
),
rider_bonus_pts AS (
  SELECT
    COALESCE(manager_id, target_manager_id) AS manager_id,
    league_id,
    sum(points) AS rider_bonus
  FROM bonus_points
  GROUP BY COALESCE(manager_id, target_manager_id), league_id
),
scoreurs AS (
  SELECT
    r.manager_id,
    r.league_id,
    count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id
),
victories AS (
  SELECT
    r.manager_id,
    r.league_id,
    count(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE rr.position = 1 
    AND rr.statut = 'finished'
    AND rr.type_classement IN ('Etape', 'General')
    AND NOT EXISTS (
      SELECT 1 FROM race_results rr2
      WHERE rr2.course_id = rr.course_id 
        AND rr2.type_classement = rr.type_classement 
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2.position = 1 
        AND rr2.statut = 'finished'
      GROUP BY rr2.course_id, rr2.type_classement, COALESCE(rr2.etape_numero, -1)
      HAVING count(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.total_race_pts, 0)::numeric AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0)::bigint AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0)::bigint AS rider_bonus,
  (COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0))::numeric AS total_points,
  COALESCE(sc.nb_scoreurs, 0)::bigint AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0)::bigint AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
FULL JOIN manager_bonus_pts mbp USING (manager_id, league_id)
FULL JOIN rider_bonus_pts rbp USING (manager_id, league_id)
FULL JOIN scoreurs sc USING (manager_id, league_id)
FULL JOIN victories v USING (manager_id, league_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

-- v_top_riders_by_phase
CREATE VIEW v_top_riders_by_phase AS
SELECT
  co.phase_id,
  pl.coureur_id,
  c.nom AS coureur_nom,
  es.nom_affiche AS coureur_equipe,
  sum(pl.points) AS total_points,
  count(DISTINCT pl.course_id) AS courses_count
FROM points_ledger pl
LEFT JOIN coureurs c ON c.id = pl.coureur_id
LEFT JOIN courses co ON co.id = pl.course_id
LEFT JOIN phases ph ON ph.id = co.phase_id
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = pl.coureur_id AND cs.saison_id = ph.saison_id
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = ph.saison_id
GROUP BY co.phase_id, pl.coureur_id, c.nom, es.nom_affiche
ORDER BY co.phase_id, sum(pl.points) DESC;

-- v_top_riders_by_season
CREATE VIEW v_top_riders_by_season AS
WITH rider_points AS (
  SELECT
    p.saison_id,
    pl.coureur_id,
    sum(pl.points) AS total_points,
    count(DISTINCT pl.course_id) AS courses_count
  FROM points_ledger pl
  JOIN phases p ON p.id = pl.phase_id
  GROUP BY p.saison_id, pl.coureur_id
)
SELECT
  rp.saison_id,
  rp.coureur_id,
  c.nom AS coureur_nom,
  c.equipe AS coureur_equipe,
  rp.total_points,
  rp.courses_count
FROM rider_points rp
JOIN coureurs c ON c.id = rp.coureur_id
WHERE rp.total_points > 0
ORDER BY rp.saison_id, rp.total_points DESC;

-- v_top_riders_global
CREATE VIEW v_top_riders_global AS
SELECT
  pl.coureur_id,
  c.nom AS coureur_nom,
  es.nom_affiche AS coureur_equipe,
  sum(pl.points) AS total_points,
  count(DISTINCT pl.course_id) AS courses_count
FROM points_ledger pl
LEFT JOIN coureurs c ON c.id = pl.coureur_id
LEFT JOIN courses co ON co.id = pl.course_id
LEFT JOIN phases ph ON ph.id = co.phase_id
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = pl.coureur_id AND cs.saison_id = ph.saison_id
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = ph.saison_id
GROUP BY pl.coureur_id, c.nom, es.nom_affiche
ORDER BY sum(pl.points) DESC;

-- Rétablir security_invoker sur les vues
ALTER VIEW public.v_manager_breakdown SET (security_invoker = on);
ALTER VIEW public.v_manager_standings_by_phase_v2 SET (security_invoker = on);
ALTER VIEW public.v_manager_standings_by_season_v2 SET (security_invoker = on);
ALTER VIEW public.v_manager_standings_total SET (security_invoker = on);
ALTER VIEW public.v_top_riders_by_phase SET (security_invoker = on);
ALTER VIEW public.v_top_riders_by_season SET (security_invoker = on);

-- ÉTAPE 4: Mettre à jour admin_compute_points_for_course pour utiliser ROUND au lieu de FLOOR

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
    LEFT JOIN race_result_sets rrs 
      ON rrs.course_id = j.course_id 
      AND rrs.type_classement = j.type_classement
      AND (rrs.etape_numero = j.etape_numero OR (rrs.etape_numero IS NULL AND j.etape_numero IS NULL))
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

-- ÉTAPE 5: Recréer results_course_table avec le nouveau type de retour

CREATE FUNCTION public.results_course_table(p_course_id text, p_type_classement type_classement, p_etape_numero integer DEFAULT NULL::integer, p_manager_id uuid DEFAULT NULL::uuid, p_league_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(race_result_id uuid, row_position integer, position_decimal numeric, statut result_statut, coureur_id text, coureur_nom text, equipe text, equipe_id_uci uuid, equipe_nom_uci text, manager_id uuid, manager_nom text, points_theoriques numeric, points_officiels numeric, is_my_rider boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH co AS (
    SELECT c.id, c.categorie, c.phase_id, p.saison_id
    FROM courses c
    JOIN phases p ON p.id = c.phase_id
    WHERE c.id = p_course_id
  ),
  rows AS (
    SELECT
      rr.id AS race_result_id,
      rr.position AS row_position,
      rr.position_decimal,
      rr.statut,
      rr.coureur_id,
      cou.nom AS coureur_nom,
      COALESCE(es.nom_affiche, cou.equipe, 'N/A') AS equipe,
      cs.equipe_id AS equipe_id_uci,
      e.nom_complet AS equipe_nom_uci,
      r.manager_id,
      m.nom AS manager_nom
    FROM race_results rr
    CROSS JOIN co
    JOIN coureurs cou ON cou.id = rr.coureur_id
    LEFT JOIN coureurs_saisons cs ON cs.coureur_id = cou.id AND cs.saison_id = co.saison_id
    LEFT JOIN equipes e ON e.id = cs.equipe_id
    LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = co.saison_id
    LEFT JOIN rosters r ON r.coureur_id = rr.coureur_id 
      AND r.phase_id = co.phase_id 
      AND (p_league_id IS NULL OR r.league_id = p_league_id)
    LEFT JOIN managers m ON m.id = r.manager_id
    WHERE rr.course_id = p_course_id
      AND rr.type_classement = p_type_classement
      AND (
        (p_etape_numero IS NOT NULL AND rr.etape_numero = p_etape_numero)
        OR (p_etape_numero IS NULL AND rr.etape_numero IS NULL)
      )
  ),
  pts_theo AS (
    SELECT
      ro.coureur_id,
      ro.row_position,
      ro.position_decimal AS rider_position_decimal,
      COALESCE((
        SELECT 
          CASE 
            WHEN rrs.is_ttt = true
                 AND rrs.ttt_riders_count IS NOT NULL 
                 AND rrs.ttt_riders_count > 0 
                 AND ro.position_decimal IS NOT NULL
            THEN ROUND(sr.points::numeric / rrs.ttt_riders_count, 2)
            ELSE sr.points::numeric
          END
        FROM scoring_rules_saisons sr
        CROSS JOIN co
        LEFT JOIN race_result_sets rrs 
          ON rrs.course_id = co.id 
          AND rrs.type_classement = p_type_classement
          AND (rrs.etape_numero = p_etape_numero OR (rrs.etape_numero IS NULL AND p_etape_numero IS NULL))
        WHERE sr.saison_id = co.saison_id
          AND LOWER(sr.categorie) = LOWER(co.categorie)
          AND sr.type_classement = p_type_classement
          AND sr.place = COALESCE(FLOOR(ro.position_decimal), ro.row_position)
        LIMIT 1
      ), 0) AS points_theoriques
    FROM rows ro
  )
  SELECT
    ro.race_result_id,
    ro.row_position,
    ro.position_decimal,
    ro.statut,
    ro.coureur_id,
    ro.coureur_nom,
    ro.equipe,
    ro.equipe_id_uci,
    ro.equipe_nom_uci,
    ro.manager_id,
    ro.manager_nom,
    COALESCE(pt.points_theoriques, 0)::numeric AS points_theoriques,
    COALESCE((
      SELECT SUM(pl.points)
      FROM points_ledger pl
      CROSS JOIN co
      WHERE pl.course_id = p_course_id
        AND pl.coureur_id = ro.coureur_id
        AND pl.type_classement = p_type_classement
        AND pl.phase_id = co.phase_id
        AND (
          (p_etape_numero IS NOT NULL AND pl.etape_numero = p_etape_numero)
          OR (p_etape_numero IS NULL AND pl.etape_numero IS NULL)
        )
    ), 0)::numeric AS points_officiels,
    (p_manager_id IS NOT NULL AND ro.manager_id = p_manager_id) AS is_my_rider
  FROM rows ro
  LEFT JOIN pts_theo pt ON pt.coureur_id = ro.coureur_id AND pt.row_position = ro.row_position
  ORDER BY 
    COALESCE(ro.position_decimal, ro.row_position::numeric) ASC NULLS LAST;
END;
$function$;

-- ÉTAPE 6: Créer la fonction helper pour exclure les TTT du calcul bonus scoreurs

CREATE OR REPLACE FUNCTION public.get_non_ttt_scoring_riders(p_phase_id uuid)
RETURNS TABLE(coureur_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT pl.coureur_id
  FROM public.points_ledger pl
  LEFT JOIN public.race_result_sets rrs 
    ON rrs.course_id = pl.course_id 
    AND rrs.type_classement = pl.type_classement
    AND COALESCE(rrs.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  WHERE pl.phase_id = p_phase_id
    AND pl.points > 0
    AND COALESCE(rrs.is_ttt, false) = false;
$$;