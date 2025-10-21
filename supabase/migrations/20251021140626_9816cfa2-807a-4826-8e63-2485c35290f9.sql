-- Recreate v_manager_standings_total view for global standings across all phases
-- Uses race_results.position for victory counting (Etape and General only)
CREATE OR REPLACE VIEW v_manager_standings_total AS
SELECT 
  r.manager_id,
  r.league_id,
  COALESCE(SUM(pl.points), 0)::bigint AS race_points,
  COALESCE(SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0)::bigint AS bonus_points,
  (COALESCE(SUM(pl.points), 0) + COALESCE(SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0))::bigint AS total_points,
  COUNT(DISTINCT CASE WHEN pl.points > 0 THEN pl.coureur_id END)::bigint AS scoreurs_count,
  COUNT(DISTINCT CASE WHEN rr.position = 1 AND rr.type_classement IN ('Etape'::type_classement, 'General'::type_classement) THEN pl.coureur_id END)::numeric AS victories_count
FROM rosters r
LEFT JOIN points_ledger pl ON pl.coureur_id = r.coureur_id AND pl.phase_id = r.phase_id
LEFT JOIN v_manager_bonus_aggregated mbp ON mbp.manager_id = r.manager_id AND mbp.phase_id = r.phase_id
LEFT JOIN race_results rr ON rr.coureur_id = r.coureur_id AND rr.course_id = pl.course_id AND rr.type_classement = pl.type_classement AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
GROUP BY r.manager_id, r.league_id;