-- Fix: Exclure les points TTT du comptage des scoreurs dans les 3 vues
-- Le TTT est identifié par position_decimal qui n'est pas un entier (ex: 1.1, 1.2, etc.)

-- 1. Vue par Phase
CREATE OR REPLACE VIEW v_manager_standings_by_phase_v2 
WITH (security_invoker = on)
AS
WITH race_pts AS (
  SELECT
    r.manager_id,
    r.league_id,
    r.phase_id,
    SUM(pl.points) AS total_race_pts
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
    SUM(bonus_itt + bonus_ttt + bonus_first_win + bonus_coureurs + bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points
  GROUP BY manager_id, league_id, phase_id
),
rider_bonus_pts AS (
  SELECT
    COALESCE(manager_id, target_manager_id) AS manager_id,
    league_id,
    phase_id,
    SUM(points) AS rider_bonus
  FROM bonus_points
  GROUP BY COALESCE(manager_id, target_manager_id), league_id, phase_id
),
scoreurs AS (
  SELECT
    r.manager_id,
    r.league_id,
    r.phase_id,
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN race_results rr ON rr.coureur_id = pl.coureur_id 
    AND rr.course_id = pl.course_id 
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  WHERE pl.points > 0
    -- Exclure TTT: position_decimal est un entier pour les non-TTT
    AND (rr.position_decimal IS NULL OR rr.position_decimal = FLOOR(rr.position_decimal))
  GROUP BY r.manager_id, r.league_id, r.phase_id
),
victories AS (
  SELECT
    r.manager_id,
    r.league_id,
    r.phase_id,
    COUNT(*) AS nb_victoires
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
      HAVING COUNT(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, r.phase_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, sc.phase_id, v.phase_id) AS phase_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
FULL JOIN manager_bonus_pts mbp USING (manager_id, league_id, phase_id)
FULL JOIN rider_bonus_pts rbp USING (manager_id, league_id, phase_id)
FULL JOIN scoreurs sc USING (manager_id, league_id, phase_id)
FULL JOIN victories v USING (manager_id, league_id, phase_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

-- 2. Vue par Saison
CREATE OR REPLACE VIEW v_manager_standings_by_season_v2 
WITH (security_invoker = on)
AS
WITH race_pts AS (
  SELECT
    r.manager_id,
    r.league_id,
    p.saison_id,
    SUM(pl.points) AS total_race_pts
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
    SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN phases p ON p.id = mbp.phase_id
  GROUP BY mbp.manager_id, mbp.league_id, p.saison_id
),
rider_bonus_pts AS (
  SELECT
    COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
    bp.league_id,
    p.saison_id,
    SUM(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN phases p ON p.id = bp.phase_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, p.saison_id
),
scoreurs AS (
  SELECT
    r.manager_id,
    r.league_id,
    p.saison_id,
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN race_results rr ON rr.coureur_id = pl.coureur_id 
    AND rr.course_id = pl.course_id 
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  WHERE pl.points > 0
    -- Exclure TTT: position_decimal est un entier pour les non-TTT
    AND (rr.position_decimal IS NULL OR rr.position_decimal = FLOOR(rr.position_decimal))
  GROUP BY r.manager_id, r.league_id, p.saison_id
),
victories AS (
  SELECT
    r.manager_id,
    r.league_id,
    p.saison_id,
    COUNT(*) AS nb_victoires
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
      HAVING COUNT(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, p.saison_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, sc.saison_id, v.saison_id) AS saison_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
FULL JOIN manager_bonus_pts mbp USING (manager_id, league_id, saison_id)
FULL JOIN rider_bonus_pts rbp USING (manager_id, league_id, saison_id)
FULL JOIN scoreurs sc USING (manager_id, league_id, saison_id)
FULL JOIN victories v USING (manager_id, league_id, saison_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

-- 3. Vue Total (globale) - DROP et CREATE pour changer les types
DROP VIEW IF EXISTS v_manager_standings_total;
CREATE VIEW v_manager_standings_total 
WITH (security_invoker = on)
AS
SELECT 
  r.manager_id,
  r.league_id,
  COALESCE(SUM(pl.points), 0) AS race_points,
  COALESCE(SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0) AS bonus_points,
  COALESCE(SUM(pl.points), 0) + COALESCE(SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0) AS total_points,
  -- Exclure TTT: position_decimal est un entier pour les non-TTT
  COUNT(DISTINCT CASE 
    WHEN pl.points > 0 AND (rr.position_decimal IS NULL OR rr.position_decimal = FLOOR(rr.position_decimal)) 
    THEN pl.coureur_id 
  END)::bigint AS scoreurs_count,
  COUNT(DISTINCT CASE 
    WHEN rr.position = 1 AND rr.type_classement IN ('Etape'::type_classement, 'General'::type_classement) 
    THEN pl.coureur_id 
  END)::numeric AS victories_count
FROM rosters r
LEFT JOIN points_ledger pl ON pl.coureur_id = r.coureur_id AND pl.phase_id = r.phase_id
LEFT JOIN v_manager_bonus_aggregated mbp ON mbp.manager_id = r.manager_id AND mbp.phase_id = r.phase_id AND mbp.league_id = r.league_id
LEFT JOIN race_results rr ON rr.coureur_id = r.coureur_id AND rr.course_id = pl.course_id AND rr.type_classement = pl.type_classement AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
GROUP BY r.manager_id, r.league_id;