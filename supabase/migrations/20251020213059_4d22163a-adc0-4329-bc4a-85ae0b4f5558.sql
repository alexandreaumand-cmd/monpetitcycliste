-- Enrichir v_manager_standings_by_phase_v2 avec bonus, scoreurs et victoires
DROP VIEW IF EXISTS public.v_manager_standings_by_phase_v2;

CREATE VIEW public.v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT
    pl.league_id,
    pl.phase_id,
    pl.manager_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.coureur_id) FILTER (WHERE pl.points > 0) AS scoreurs_count
  FROM public.points_ledger pl
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.league_id, pl.phase_id, pl.manager_id
),
manager_bonus_pts AS (
  SELECT 
    pl.league_id,
    mbp.phase_id,
    mbp.manager_id,
    SUM(
      COALESCE(mbp.bonus_itt, 0) + 
      COALESCE(mbp.bonus_ttt, 0) + 
      COALESCE(mbp.bonus_first_win, 0) + 
      COALESCE(mbp.bonus_coureurs, 0) + 
      COALESCE(mbp.bonus_scoreurs, 0)
    ) AS manager_bonus_total
  FROM public.manager_bonus_points mbp
  CROSS JOIN LATERAL (
    SELECT DISTINCT league_id 
    FROM public.points_ledger 
    WHERE phase_id = mbp.phase_id 
    LIMIT 1
  ) pl
  GROUP BY pl.league_id, mbp.phase_id, mbp.manager_id
),
rider_bonus_pts AS (
  SELECT
    pl.league_id,
    bp.phase_id,
    COALESCE(bp.target_manager_id, bp.manager_id) AS manager_id,
    SUM(bp.points) AS rider_bonus_total
  FROM public.bonus_points bp
  CROSS JOIN LATERAL (
    SELECT DISTINCT league_id 
    FROM public.points_ledger 
    WHERE phase_id = bp.phase_id 
    LIMIT 1
  ) pl
  WHERE (bp.target_manager_id IS NOT NULL OR bp.manager_id IS NOT NULL)
  GROUP BY pl.league_id, bp.phase_id, COALESCE(bp.target_manager_id, bp.manager_id)
),
victories AS (
  SELECT
    pl.league_id,
    pl.phase_id,
    pl.manager_id,
    COUNT(*) AS victories_count
  FROM public.points_ledger pl
  JOIN public.race_results rr 
    ON rr.course_id = pl.course_id 
    AND rr.coureur_id = pl.coureur_id
    AND rr.type_classement = pl.type_classement
  WHERE pl.manager_id IS NOT NULL
    AND rr.position = 1
    AND rr.statut = 'finished'
    AND rr.type_classement IN ('General', 'Etape')
  GROUP BY pl.league_id, pl.phase_id, pl.manager_id
)
SELECT
  rp.league_id,
  rp.phase_id,
  rp.manager_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus_total, 0) + COALESCE(rbp.rider_bonus_total, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus_total, 0) + COALESCE(rbp.rider_bonus_total, 0) AS total_points,
  COALESCE(rp.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM race_pts rp
LEFT JOIN manager_bonus_pts mbp USING (league_id, phase_id, manager_id)
LEFT JOIN rider_bonus_pts rbp USING (league_id, phase_id, manager_id)
LEFT JOIN victories v USING (league_id, phase_id, manager_id);

-- Enrichir v_manager_standings_by_season_v2 avec bonus, scoreurs et victoires
DROP VIEW IF EXISTS public.v_manager_standings_by_season_v2;

CREATE VIEW public.v_manager_standings_by_season_v2 AS
WITH race_pts AS (
  SELECT
    pl.league_id,
    p.saison_id AS season_id,
    pl.manager_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.coureur_id) FILTER (WHERE pl.points > 0) AS scoreurs_count
  FROM public.points_ledger pl
  JOIN public.courses c ON c.id = pl.course_id
  JOIN public.phases p ON p.id = c.phase_id
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.league_id, p.saison_id, pl.manager_id
),
manager_bonus_pts AS (
  SELECT 
    rp.league_id,
    p.saison_id AS season_id,
    mbp.manager_id,
    SUM(
      COALESCE(mbp.bonus_itt, 0) + 
      COALESCE(mbp.bonus_ttt, 0) + 
      COALESCE(mbp.bonus_first_win, 0) + 
      COALESCE(mbp.bonus_coureurs, 0) + 
      COALESCE(mbp.bonus_scoreurs, 0)
    ) AS manager_bonus_total
  FROM public.manager_bonus_points mbp
  JOIN public.phases p ON p.id = mbp.phase_id
  CROSS JOIN LATERAL (
    SELECT DISTINCT league_id 
    FROM public.points_ledger 
    WHERE phase_id = mbp.phase_id 
    LIMIT 1
  ) rp
  GROUP BY rp.league_id, p.saison_id, mbp.manager_id
),
rider_bonus_pts AS (
  SELECT
    rp.league_id,
    p.saison_id AS season_id,
    COALESCE(bp.target_manager_id, bp.manager_id) AS manager_id,
    SUM(bp.points) AS rider_bonus_total
  FROM public.bonus_points bp
  JOIN public.phases p ON p.id = bp.phase_id
  CROSS JOIN LATERAL (
    SELECT DISTINCT league_id 
    FROM public.points_ledger 
    WHERE phase_id = bp.phase_id 
    LIMIT 1
  ) rp
  WHERE (bp.target_manager_id IS NOT NULL OR bp.manager_id IS NOT NULL)
  GROUP BY rp.league_id, p.saison_id, COALESCE(bp.target_manager_id, bp.manager_id)
),
victories AS (
  SELECT
    pl.league_id,
    p.saison_id AS season_id,
    pl.manager_id,
    COUNT(*) AS victories_count
  FROM public.points_ledger pl
  JOIN public.courses c ON c.id = pl.course_id
  JOIN public.phases p ON p.id = c.phase_id
  JOIN public.race_results rr 
    ON rr.course_id = pl.course_id 
    AND rr.coureur_id = pl.coureur_id
    AND rr.type_classement = pl.type_classement
  WHERE pl.manager_id IS NOT NULL
    AND rr.position = 1
    AND rr.statut = 'finished'
    AND rr.type_classement IN ('General', 'Etape')
  GROUP BY pl.league_id, p.saison_id, pl.manager_id
)
SELECT
  rp.league_id,
  rp.season_id,
  rp.manager_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus_total, 0) + COALESCE(rbp.rider_bonus_total, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus_total, 0) + COALESCE(rbp.rider_bonus_total, 0) AS total_points,
  COALESCE(rp.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM race_pts rp
LEFT JOIN manager_bonus_pts mbp USING (league_id, season_id, manager_id)
LEFT JOIN rider_bonus_pts rbp USING (league_id, season_id, manager_id)
LEFT JOIN victories v USING (league_id, season_id, manager_id);