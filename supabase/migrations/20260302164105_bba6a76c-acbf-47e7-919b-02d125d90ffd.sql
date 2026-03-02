
CREATE OR REPLACE FUNCTION public.get_weekly_points_heatmap(p_league_id uuid, p_saison_id uuid)
 RETURNS TABLE(manager_id uuid, manager_nom text, week_number integer, total_points numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH race_week_points AS (
    -- Base race points + rider bonus (x1.25 if bonus selection exists)
    SELECT
      r.manager_id,
      m.nom AS manager_nom,
      EXTRACT(WEEK FROM rr.date_classement)::int AS week_number,
      SUM(
        pl.points *
        CASE WHEN brs.id IS NOT NULL THEN 1.25 ELSE 1.0 END
      ) AS total_points
    FROM points_ledger pl
    JOIN race_results rr
      ON rr.course_id = pl.course_id
      AND rr.coureur_id = pl.coureur_id
      AND rr.type_classement = pl.type_classement
      AND COALESCE(rr.etape_numero, 0) = COALESCE(pl.etape_numero, 0)
    JOIN rosters r
      ON r.coureur_id = pl.coureur_id
      AND r.phase_id = pl.phase_id
      AND r.league_id = p_league_id
    JOIN managers m ON m.id = r.manager_id
    JOIN phases p ON p.id = pl.phase_id
    LEFT JOIN bonus_rider_selections brs
      ON brs.coureur_id = pl.coureur_id
      AND brs.phase_id = pl.phase_id
      AND brs.manager_id = r.manager_id
      AND brs.league_id = r.league_id
    WHERE p.saison_id = p_saison_id
    GROUP BY r.manager_id, m.nom, EXTRACT(WEEK FROM rr.date_classement)
  ),
  manager_bonus_weekly AS (
    -- Manager bonuses attributed to the last week of results in that phase
    SELECT
      mbp.manager_id,
      m.nom AS manager_nom,
      latest_week.week_number,
      (COALESCE(mbp.bonus_itt, 0) + COALESCE(mbp.bonus_ttt, 0) + 
       COALESCE(mbp.bonus_first_win, 0) + COALESCE(mbp.bonus_coureurs, 0) + 
       COALESCE(mbp.bonus_scoreurs, 0))::numeric AS total_points
    FROM manager_bonus_points mbp
    JOIN managers m ON m.id = mbp.manager_id
    JOIN phases p ON p.id = mbp.phase_id
    CROSS JOIN LATERAL (
      SELECT MAX(EXTRACT(WEEK FROM rr2.date_classement))::int AS week_number
      FROM points_ledger pl2
      JOIN race_results rr2
        ON rr2.course_id = pl2.course_id
        AND rr2.coureur_id = pl2.coureur_id
        AND rr2.type_classement = pl2.type_classement
        AND COALESCE(rr2.etape_numero, 0) = COALESCE(pl2.etape_numero, 0)
      WHERE pl2.phase_id = mbp.phase_id
    ) latest_week
    WHERE p.saison_id = p_saison_id
      AND mbp.league_id = p_league_id
      AND latest_week.week_number IS NOT NULL
      AND (COALESCE(mbp.bonus_itt, 0) + COALESCE(mbp.bonus_ttt, 0) + 
           COALESCE(mbp.bonus_first_win, 0) + COALESCE(mbp.bonus_coureurs, 0) + 
           COALESCE(mbp.bonus_scoreurs, 0)) > 0
  ),
  combined AS (
    SELECT manager_id, manager_nom, week_number, total_points FROM race_week_points
    UNION ALL
    SELECT manager_id, manager_nom, week_number, total_points FROM manager_bonus_weekly
  )
  SELECT
    combined.manager_id,
    combined.manager_nom,
    combined.week_number,
    SUM(combined.total_points) AS total_points
  FROM combined
  GROUP BY combined.manager_id, combined.manager_nom, combined.week_number
$$;
