-- Drop existing views
DROP VIEW IF EXISTS v_manager_standings_total;
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;

-- Recreate v_manager_standings_by_phase_v2 with corrected victories
CREATE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    c.phase_id,
    SUM(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  GROUP BY r.manager_id, r.league_id, c.phase_id
),
manager_bonus_pts AS (
  SELECT 
    mbp.manager_id,
    mbp.league_id,
    mbp.phase_id,
    SUM(
      mbp.bonus_itt + 
      mbp.bonus_ttt + 
      mbp.bonus_first_win + 
      mbp.bonus_coureurs + 
      mbp.bonus_scoreurs
    ) AS manager_bonus
  FROM manager_bonus_points mbp
  GROUP BY mbp.manager_id, mbp.league_id, mbp.phase_id
),
rider_bonus_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    bp.phase_id,
    SUM(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN rosters r ON r.coureur_id = bp.coureur_id AND r.phase_id = bp.phase_id
  GROUP BY r.manager_id, r.league_id, bp.phase_id
),
scoreurs AS (
  SELECT 
    r.manager_id,
    r.league_id,
    c.phase_id,
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, c.phase_id
),
victories AS (
  SELECT 
    r.manager_id,
    r.league_id,
    c.phase_id,
    COUNT(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN phases p ON p.id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE rr.position = 1 
    AND rr.statut = 'finished'
    AND rr.type_classement IN ('Etape', 'General')
    AND NOT EXISTS (
      SELECT 1 
      FROM race_results rr2 
      WHERE rr2.course_id = rr.course_id 
        AND rr2.type_classement = rr.type_classement
        AND rr2.etape_numero = rr.etape_numero
        AND rr2.position = 1 
        AND rr2.statut = 'finished'
      GROUP BY rr2.course_id, rr2.type_classement, rr2.etape_numero
      HAVING COUNT(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, c.phase_id
),
all_managers AS (
  SELECT DISTINCT manager_id, league_id, phase_id
  FROM (
    SELECT manager_id, league_id, phase_id FROM race_pts
    UNION
    SELECT manager_id, league_id, phase_id FROM manager_bonus_pts
    UNION
    SELECT manager_id, league_id, phase_id FROM rider_bonus_pts
    UNION
    SELECT manager_id, league_id, phase_id FROM scoreurs
    UNION
    SELECT manager_id, league_id, phase_id FROM victories
  ) u
)
SELECT 
  am.manager_id,
  am.league_id,
  am.phase_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom
FROM all_managers am
LEFT JOIN race_pts rp ON rp.manager_id = am.manager_id AND rp.league_id = am.league_id AND rp.phase_id = am.phase_id
LEFT JOIN manager_bonus_pts mbp ON mbp.manager_id = am.manager_id AND mbp.league_id = am.league_id AND mbp.phase_id = am.phase_id
LEFT JOIN rider_bonus_pts rbp ON rbp.manager_id = am.manager_id AND rbp.league_id = am.league_id AND rbp.phase_id = am.phase_id
LEFT JOIN scoreurs sc ON sc.manager_id = am.manager_id AND sc.league_id = am.league_id AND sc.phase_id = am.phase_id
LEFT JOIN victories v ON v.manager_id = am.manager_id AND v.league_id = am.league_id AND v.phase_id = am.phase_id
LEFT JOIN managers m ON m.id = am.manager_id;

-- Recreate v_manager_standings_by_season_v2 with corrected victories
CREATE VIEW v_manager_standings_by_season_v2 AS
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
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  GROUP BY r.manager_id, r.league_id, p.saison_id
),
manager_bonus_pts AS (
  SELECT 
    mbp.manager_id,
    mbp.league_id,
    p.saison_id,
    SUM(
      mbp.bonus_itt + 
      mbp.bonus_ttt + 
      mbp.bonus_first_win + 
      mbp.bonus_coureurs + 
      mbp.bonus_scoreurs
    ) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN phases p ON p.id = mbp.phase_id
  GROUP BY mbp.manager_id, mbp.league_id, p.saison_id
),
rider_bonus_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    p.saison_id,
    SUM(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN phases p ON p.id = bp.phase_id
  JOIN rosters r ON r.coureur_id = bp.coureur_id AND r.phase_id = bp.phase_id
  GROUP BY r.manager_id, r.league_id, p.saison_id
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
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE pl.points > 0
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
      SELECT 1 
      FROM race_results rr2 
      WHERE rr2.course_id = rr.course_id 
        AND rr2.type_classement = rr.type_classement
        AND rr2.etape_numero = rr.etape_numero
        AND rr2.position = 1 
        AND rr2.statut = 'finished'
      GROUP BY rr2.course_id, rr2.type_classement, rr2.etape_numero
      HAVING COUNT(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, p.saison_id
),
all_managers AS (
  SELECT DISTINCT manager_id, league_id, saison_id
  FROM (
    SELECT manager_id, league_id, saison_id FROM race_pts
    UNION
    SELECT manager_id, league_id, saison_id FROM manager_bonus_pts
    UNION
    SELECT manager_id, league_id, saison_id FROM rider_bonus_pts
    UNION
    SELECT manager_id, league_id, saison_id FROM scoreurs
    UNION
    SELECT manager_id, league_id, saison_id FROM victories
  ) u
)
SELECT 
  am.manager_id,
  am.league_id,
  am.saison_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom
FROM all_managers am
LEFT JOIN race_pts rp ON rp.manager_id = am.manager_id AND rp.league_id = am.league_id AND rp.saison_id = am.saison_id
LEFT JOIN manager_bonus_pts mbp ON mbp.manager_id = am.manager_id AND mbp.league_id = am.league_id AND mbp.saison_id = am.saison_id
LEFT JOIN rider_bonus_pts rbp ON rbp.manager_id = am.manager_id AND rbp.league_id = am.league_id AND rbp.saison_id = am.saison_id
LEFT JOIN scoreurs sc ON sc.manager_id = am.manager_id AND sc.league_id = am.league_id AND sc.saison_id = am.saison_id
LEFT JOIN victories v ON v.manager_id = am.manager_id AND v.league_id = am.league_id AND v.saison_id = am.saison_id
LEFT JOIN managers m ON m.id = am.manager_id;

-- Recreate v_manager_standings_total with corrected victories
CREATE VIEW v_manager_standings_total AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    SUM(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  GROUP BY r.manager_id, r.league_id
),
manager_bonus_pts AS (
  SELECT 
    mbp.manager_id,
    mbp.league_id,
    SUM(
      mbp.bonus_itt + 
      mbp.bonus_ttt + 
      mbp.bonus_first_win + 
      mbp.bonus_coureurs + 
      mbp.bonus_scoreurs
    ) AS manager_bonus
  FROM manager_bonus_points mbp
  GROUP BY mbp.manager_id, mbp.league_id
),
rider_bonus_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    SUM(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN rosters r ON r.coureur_id = bp.coureur_id AND r.phase_id = bp.phase_id
  GROUP BY r.manager_id, r.league_id
),
scoreurs AS (
  SELECT 
    r.manager_id,
    r.league_id,
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id
),
victories AS (
  SELECT 
    r.manager_id,
    r.league_id,
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
      SELECT 1 
      FROM race_results rr2 
      WHERE rr2.course_id = rr.course_id 
        AND rr2.type_classement = rr.type_classement
        AND rr2.etape_numero = rr.etape_numero
        AND rr2.position = 1 
        AND rr2.statut = 'finished'
      GROUP BY rr2.course_id, rr2.type_classement, rr2.etape_numero
      HAVING COUNT(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id
),
all_managers AS (
  SELECT DISTINCT manager_id, league_id
  FROM (
    SELECT manager_id, league_id FROM race_pts
    UNION
    SELECT manager_id, league_id FROM manager_bonus_pts
    UNION
    SELECT manager_id, league_id FROM rider_bonus_pts
    UNION
    SELECT manager_id, league_id FROM scoreurs
    UNION
    SELECT manager_id, league_id FROM victories
  ) u
)
SELECT 
  am.manager_id,
  am.league_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom
FROM all_managers am
LEFT JOIN race_pts rp ON rp.manager_id = am.manager_id AND rp.league_id = am.league_id
LEFT JOIN manager_bonus_pts mbp ON mbp.manager_id = am.manager_id AND mbp.league_id = am.league_id
LEFT JOIN rider_bonus_pts rbp ON rbp.manager_id = am.manager_id AND rbp.league_id = am.league_id
LEFT JOIN scoreurs sc ON sc.manager_id = am.manager_id AND sc.league_id = am.league_id
LEFT JOIN victories v ON v.manager_id = am.manager_id AND v.league_id = am.league_id
LEFT JOIN managers m ON m.id = am.manager_id;