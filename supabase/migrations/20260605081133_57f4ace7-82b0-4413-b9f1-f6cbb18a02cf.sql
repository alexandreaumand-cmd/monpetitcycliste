CREATE OR REPLACE FUNCTION public.get_weekly_points_heatmap(p_league_id uuid, p_saison_id uuid)
 RETURNS TABLE(manager_id uuid, manager_nom text, week_number integer, total_points numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH league_info AS (
    SELECT COALESCE(l.started_at_effective, l.created_at)::date AS date_floor
    FROM leagues l WHERE l.id = p_league_id
  ),
  allowed_courses AS (
    SELECT course_id FROM get_league_course_ids(p_league_id)
  ),
  race_week_points AS (
    SELECT
      r.manager_id,
      m.nom AS manager_nom,
      EXTRACT(WEEK FROM COALESCE(csc.stage_date, rr.date_classement))::int AS week_number,
      SUM(pl.points * CASE WHEN brs.id IS NOT NULL THEN 1.25 ELSE 1.0 END) AS total_points
    FROM points_ledger pl
    JOIN race_results rr
      ON rr.course_id = pl.course_id
      AND rr.coureur_id = pl.coureur_id
      AND rr.type_classement = pl.type_classement
      AND COALESCE(rr.etape_numero, 0) = COALESCE(pl.etape_numero, 0)
    LEFT JOIN course_stage_config csc
      ON csc.course_id = pl.course_id
      AND csc.etape_numero = pl.etape_numero
    JOIN rosters r
      ON r.coureur_id = pl.coureur_id
      AND r.phase_id = pl.phase_id
      AND r.league_id = p_league_id
    JOIN managers m ON m.id = r.manager_id
    JOIN phases p ON p.id = pl.phase_id
    JOIN courses c ON c.id = pl.course_id
    CROSS JOIN league_info li
    LEFT JOIN bonus_rider_selections brs
      ON brs.coureur_id = pl.coureur_id
      AND brs.phase_id = pl.phase_id
      AND brs.manager_id = r.manager_id
      AND brs.league_id = r.league_id
    WHERE p.saison_id = p_saison_id
      AND c.date_debut >= li.date_floor
      AND pl.course_id IN (SELECT course_id FROM allowed_courses)
    GROUP BY r.manager_id, m.nom, EXTRACT(WEEK FROM COALESCE(csc.stage_date, rr.date_classement))
  ),
  manager_bonus_weekly AS (
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
      SELECT MAX(EXTRACT(WEEK FROM COALESCE(csc2.stage_date, rr2.date_classement)))::int AS week_number
      FROM points_ledger pl2
      JOIN race_results rr2
        ON rr2.course_id = pl2.course_id
        AND rr2.coureur_id = pl2.coureur_id
        AND rr2.type_classement = pl2.type_classement
        AND COALESCE(rr2.etape_numero, 0) = COALESCE(pl2.etape_numero, 0)
      LEFT JOIN course_stage_config csc2
        ON csc2.course_id = pl2.course_id
        AND csc2.etape_numero = pl2.etape_numero
      JOIN courses c2 ON c2.id = pl2.course_id
      CROSS JOIN league_info li
      WHERE pl2.phase_id = mbp.phase_id
        AND c2.date_debut >= li.date_floor
        AND pl2.course_id IN (SELECT course_id FROM allowed_courses)
    ) latest_week
    WHERE p.saison_id = p_saison_id
      AND mbp.league_id = p_league_id
      AND latest_week.week_number IS NOT NULL
      AND (COALESCE(mbp.bonus_itt, 0) + COALESCE(mbp.bonus_ttt, 0) +
           COALESCE(mbp.bonus_first_win, 0) + COALESCE(mbp.bonus_coureurs, 0) +
           COALESCE(mbp.bonus_scoreurs, 0)) > 0
  ),
  rider_bonus_weekly AS (
    SELECT
      COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
      m.nom AS manager_nom,
      COALESCE(
        EXTRACT(WEEK FROM c.date_debut)::int,
        latest_week.week_number
      ) AS week_number,
      bp.points::numeric AS total_points
    FROM bonus_points bp
    JOIN managers m ON m.id = COALESCE(bp.manager_id, bp.target_manager_id)
    JOIN phases p ON p.id = bp.phase_id
    LEFT JOIN courses c ON c.id = bp.course_id
    CROSS JOIN league_info li
    LEFT JOIN LATERAL (
      SELECT MAX(EXTRACT(WEEK FROM COALESCE(csc3.stage_date, rr3.date_classement)))::int AS week_number
      FROM points_ledger pl3
      JOIN race_results rr3
        ON rr3.course_id = pl3.course_id
        AND rr3.coureur_id = pl3.coureur_id
        AND rr3.type_classement = pl3.type_classement
        AND COALESCE(rr3.etape_numero, 0) = COALESCE(pl3.etape_numero, 0)
      LEFT JOIN course_stage_config csc3
        ON csc3.course_id = pl3.course_id
        AND csc3.etape_numero = pl3.etape_numero
      JOIN courses c3 ON c3.id = pl3.course_id
      WHERE pl3.phase_id = bp.phase_id
        AND c3.date_debut >= li.date_floor
        AND pl3.course_id IN (SELECT course_id FROM allowed_courses)
    ) latest_week ON TRUE
    WHERE p.saison_id = p_saison_id
      AND bp.league_id = p_league_id
      AND COALESCE(bp.manager_id, bp.target_manager_id) IS NOT NULL
      AND bp.points <> 0
      AND (
        c.id IS NULL
        OR (c.id IN (SELECT course_id FROM allowed_courses) AND c.date_debut >= li.date_floor)
      )
  ),
  combined AS (
    SELECT manager_id, manager_nom, week_number, total_points FROM race_week_points
    UNION ALL
    SELECT manager_id, manager_nom, week_number, total_points FROM manager_bonus_weekly
    UNION ALL
    SELECT manager_id, manager_nom, week_number, total_points FROM rider_bonus_weekly
    WHERE week_number IS NOT NULL
  )
  SELECT
    combined.manager_id,
    combined.manager_nom,
    combined.week_number,
    SUM(combined.total_points)::numeric AS total_points
  FROM combined
  GROUP BY combined.manager_id, combined.manager_nom, combined.week_number
  ORDER BY combined.manager_nom, combined.week_number
$function$;