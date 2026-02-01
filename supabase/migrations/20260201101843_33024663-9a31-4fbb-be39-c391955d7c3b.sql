-- Migration: Bonus Coureur +25% avec précision décimale
-- Supprimer TOUTES les vues qui dépendent de bonus_points.points

-- Étape 1: Drop toutes les vues dépendantes
DROP VIEW IF EXISTS public.v_manager_standings_total CASCADE;
DROP VIEW IF EXISTS public.v_manager_standings_by_phase_v2 CASCADE;
DROP VIEW IF EXISTS public.v_manager_standings_by_season_v2 CASCADE;
DROP VIEW IF EXISTS public.v_manager_bonus_aggregated CASCADE;

-- Étape 2: Modifier la colonne points de INTEGER vers NUMERIC(10,2)
ALTER TABLE bonus_points 
ALTER COLUMN points TYPE NUMERIC(10,2);

-- Étape 3: Recréer v_manager_bonus_aggregated
CREATE VIEW public.v_manager_bonus_aggregated 
WITH (security_invoker = on)
AS
SELECT 
  phase_id,
  league_id,
  COALESCE(target_manager_id, manager_id) as manager_id,
  SUM(CASE WHEN bonus_type = 'itt' THEN points ELSE 0 END)::NUMERIC(10,2) as bonus_itt,
  SUM(CASE WHEN bonus_type = 'ttt' THEN points ELSE 0 END)::NUMERIC(10,2) as bonus_ttt,
  SUM(CASE WHEN bonus_type = 'first_win' THEN points ELSE 0 END)::NUMERIC(10,2) as bonus_first_win,
  SUM(CASE WHEN bonus_type IN ('coureur_bonuse', 'coureur_bonus_25') THEN points ELSE 0 END)::NUMERIC(10,2) as bonus_coureurs,
  SUM(CASE WHEN bonus_type = 'scoreurs' THEN points ELSE 0 END)::NUMERIC(10,2) as bonus_scoreurs,
  STRING_AGG(DISTINCT commentaire, ' | ' ORDER BY commentaire) FILTER (WHERE commentaire IS NOT NULL) as commentaire,
  MAX(created_at) as created_at,
  MAX(updated_at) as updated_at
FROM public.bonus_points
GROUP BY phase_id, league_id, COALESCE(target_manager_id, manager_id);

-- Étape 4: Recréer v_manager_standings_by_phase_v2 (sans league_id sur points_ledger)
CREATE VIEW v_manager_standings_by_phase_v2 
WITH (security_invoker = on)
AS
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
  COALESCE(rbp.rider_bonus, 0)::numeric AS rider_bonus,
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

-- Étape 5: Recréer v_manager_standings_by_season_v2
CREATE VIEW v_manager_standings_by_season_v2 
WITH (security_invoker = on)
AS
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
  COALESCE(rbp.rider_bonus, 0)::numeric AS rider_bonus,
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

-- Étape 6: Recréer v_manager_standings_total
CREATE VIEW public.v_manager_standings_total
WITH (security_invoker = on)
AS
SELECT 
  r.manager_id,
  r.league_id,
  COALESCE(SUM(pl.points), 0) AS race_points,
  COALESCE(SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0) AS bonus_points,
  (COALESCE(SUM(pl.points), 0) + COALESCE(SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0)) AS total_points,
  COUNT(DISTINCT CASE WHEN pl.points > 0 THEN pl.coureur_id END)::bigint AS scoreurs_count,
  COUNT(DISTINCT CASE WHEN rr.position = 1 AND rr.type_classement IN ('Etape'::type_classement, 'General'::type_classement) THEN pl.coureur_id END)::numeric AS victories_count
FROM rosters r
LEFT JOIN points_ledger pl ON pl.coureur_id = r.coureur_id AND pl.phase_id = r.phase_id
LEFT JOIN v_manager_bonus_aggregated mbp ON mbp.manager_id = r.manager_id AND mbp.phase_id = r.phase_id AND mbp.league_id = r.league_id
LEFT JOIN race_results rr ON rr.coureur_id = r.coureur_id AND rr.course_id = pl.course_id AND rr.type_classement = pl.type_classement AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
GROUP BY r.manager_id, r.league_id;

-- Étape 7: Recréer la fonction trigger avec calcul décimal
CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus_record RECORD;
  v_bonus_amount NUMERIC(10,2);
  v_saison_id uuid;
  v_cote_initiale NUMERIC;
  v_comment text;
BEGIN
  -- Only process if the rider is selected for bonus in this phase
  SELECT brs.*, cs.prix_initial as cote_initiale, p.saison_id
  INTO v_bonus_record
  FROM bonus_rider_selections brs
  JOIN phases p ON p.id = brs.phase_id
  JOIN coureurs_saisons cs ON cs.coureur_id = brs.coureur_id AND cs.saison_id = p.saison_id
  WHERE brs.coureur_id = NEW.coureur_id
    AND brs.phase_id = NEW.phase_id
    AND brs.manager_id = NEW.manager_id
    AND brs.league_id = NEW.league_id;

  IF v_bonus_record IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate 25% bonus with 2 decimal precision
  v_bonus_amount := ROUND(NEW.points * 0.25, 2);
  
  IF v_bonus_amount <= 0 THEN
    RETURN NEW;
  END IF;

  -- Build comment with course info
  v_comment := 'Bonus +25% (cote ' || v_bonus_record.cote_initiale || ') - ' || 
               COALESCE((SELECT nom FROM courses WHERE id = NEW.course_id), 'Course');

  -- Insert bonus if not exists (prevent duplicates)
  IF NOT EXISTS (
    SELECT 1 FROM bonus_points
    WHERE phase_id = NEW.phase_id
      AND coureur_id = NEW.coureur_id
      AND manager_id = NEW.manager_id
      AND league_id = NEW.league_id
      AND bonus_type = 'coureur_bonus_25'
      AND commentaire = v_comment
  ) THEN
    INSERT INTO bonus_points (
      phase_id,
      coureur_id,
      manager_id,
      league_id,
      bonus_type,
      points,
      commentaire,
      created_by
    ) VALUES (
      NEW.phase_id,
      NEW.coureur_id,
      NEW.manager_id,
      NEW.league_id,
      'coureur_bonus_25',
      v_bonus_amount,
      v_comment,
      NEW.manager_id
    );
  END IF;

  RETURN NEW;
END;
$$;