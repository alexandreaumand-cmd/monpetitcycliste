-- Fix standings views to filter by league's configured season
-- Drop and recreate all three standings views with league_scopes filtering

DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;
DROP VIEW IF EXISTS v_manager_standings_total;

-- v_manager_standings_by_phase_v2: Standings per phase filtered by league season
CREATE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pl.phase_id,
    SUM(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN phases p ON p.id = pl.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  GROUP BY r.manager_id, r.league_id, pl.phase_id
),
manager_bonus_pts AS (
  SELECT 
    mbp.manager_id,
    mbp.league_id,
    mbp.phase_id,
    SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN phases p ON p.id = mbp.phase_id
  JOIN league_scopes ls ON ls.league_id = mbp.league_id AND ls.season_id = p.saison_id
  GROUP BY mbp.manager_id, mbp.league_id, mbp.phase_id
),
rider_bonus_pts AS (
  SELECT 
    COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
    bp.league_id,
    bp.phase_id,
    SUM(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN phases p ON p.id = bp.phase_id
  JOIN league_scopes ls ON ls.league_id = bp.league_id AND ls.season_id = p.saison_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, bp.phase_id
),
scoreurs AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pl.phase_id,
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN phases p ON p.id = pl.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, pl.phase_id
),
victories AS (
  SELECT 
    r.manager_id,
    r.league_id,
    r.phase_id,
    COUNT(*) AS nb_victoires
  FROM race_results rr
  JOIN rosters r ON r.coureur_id = rr.coureur_id
  JOIN phases p ON p.id = r.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE rr.position = 1 AND rr.statut = 'finished'
  GROUP BY r.manager_id, r.league_id, r.phase_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id) AS league_id,
  COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id) AS phase_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.phase_id = rp.phase_id AND mbp.league_id = rp.league_id
FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.phase_id = COALESCE(rp.phase_id, mbp.phase_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id)
LEFT JOIN scoreurs sc ON sc.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND sc.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id) AND sc.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id)
LEFT JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND v.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id);

-- v_manager_standings_by_season_v2: Standings per season filtered by league season
CREATE VIEW v_manager_standings_by_season_v2 AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    p.saison_id,
    SUM(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN phases p ON p.id = pl.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
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
  JOIN league_scopes ls ON ls.league_id = mbp.league_id AND ls.season_id = p.saison_id
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
  JOIN league_scopes ls ON ls.league_id = bp.league_id AND ls.season_id = p.saison_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, p.saison_id
),
scoreurs AS (
  SELECT 
    r.manager_id,
    r.league_id,
    p.saison_id,
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN phases p ON p.id = pl.phase_id
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
  JOIN rosters r ON r.coureur_id = rr.coureur_id
  JOIN phases p ON p.id = r.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE rr.position = 1 AND rr.statut = 'finished'
  GROUP BY r.manager_id, r.league_id, p.saison_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id) AS league_id,
  COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id) AS saison_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.saison_id = rp.saison_id AND mbp.league_id = rp.league_id
FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.saison_id = COALESCE(rp.saison_id, mbp.saison_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id)
LEFT JOIN scoreurs sc ON sc.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND sc.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id) AND sc.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id)
LEFT JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND v.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id);

-- v_manager_standings_total: Total standings across all phases filtered by league season
CREATE VIEW v_manager_standings_total AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    SUM(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN phases p ON p.id = pl.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  GROUP BY r.manager_id, r.league_id
),
manager_bonus_pts AS (
  SELECT 
    mbp.manager_id,
    mbp.league_id,
    SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN phases p ON p.id = mbp.phase_id
  JOIN league_scopes ls ON ls.league_id = mbp.league_id AND ls.season_id = p.saison_id
  GROUP BY mbp.manager_id, mbp.league_id
),
rider_bonus_pts AS (
  SELECT 
    COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
    bp.league_id,
    SUM(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN phases p ON p.id = bp.phase_id
  JOIN league_scopes ls ON ls.league_id = bp.league_id AND ls.season_id = p.saison_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id
),
scoreurs AS (
  SELECT 
    r.manager_id,
    r.league_id,
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN phases p ON p.id = pl.phase_id
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
  JOIN rosters r ON r.coureur_id = rr.coureur_id
  JOIN phases p ON p.id = r.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE rr.position = 1 AND rr.statut = 'finished'
  GROUP BY r.manager_id, r.league_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id) AS league_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.league_id = rp.league_id
FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id)
LEFT JOIN scoreurs sc ON sc.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND sc.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id)
LEFT JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id);