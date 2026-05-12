-- Convert v_manager_standings_total from MATERIALIZED VIEW back to a regular VIEW
-- to resolve linter 0016_materialized_view_in_api. Refresh functions were already
-- no-ops, so a regular view also fixes staleness.

DROP MATERIALIZED VIEW IF EXISTS public.v_manager_standings_total CASCADE;

CREATE VIEW public.v_manager_standings_total AS
SELECT r.manager_id,
    r.league_id,
    COALESCE(sum(pl.points), 0::numeric) AS race_points,
    COALESCE(sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0::numeric) AS bonus_points,
    COALESCE(sum(pl.points), 0::numeric) + COALESCE(sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0::numeric) AS total_points,
    count(DISTINCT
        CASE
            WHEN pl.points > 0::numeric AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal)) THEN pl.coureur_id
            ELSE NULL::text
        END) AS scoreurs_count,
    count(DISTINCT
        CASE
            WHEN rr."position" = 1 AND (rr.type_classement = ANY (ARRAY['Etape'::type_classement, 'General'::type_classement])) THEN pl.coureur_id
            ELSE NULL::text
        END)::numeric AS victories_count
   FROM rosters r
     LEFT JOIN points_ledger pl ON pl.coureur_id = r.coureur_id AND pl.phase_id = r.phase_id AND (pl.course_id IN ( SELECT glc.course_id
           FROM get_league_course_ids(r.league_id) glc(course_id)))
     LEFT JOIN v_manager_bonus_aggregated mbp ON mbp.manager_id = r.manager_id AND mbp.phase_id = r.phase_id AND mbp.league_id = r.league_id
     LEFT JOIN race_results rr ON rr.coureur_id = r.coureur_id AND rr.course_id = pl.course_id AND rr.type_classement = pl.type_classement AND COALESCE(rr.etape_numero, '-1'::integer) = COALESCE(pl.etape_numero, '-1'::integer)
  GROUP BY r.manager_id, r.league_id;

GRANT SELECT ON public.v_manager_standings_total TO anon, authenticated, service_role;