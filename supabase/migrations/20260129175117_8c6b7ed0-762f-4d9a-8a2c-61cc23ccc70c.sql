-- Add security_invoker to v_top_riders_by_phase view (preserving existing columns)
DROP VIEW IF EXISTS public.v_top_riders_by_phase;
CREATE VIEW public.v_top_riders_by_phase
WITH (security_invoker = on)
AS
SELECT 
  pl.phase_id,
  pl.coureur_id,
  c.nom AS coureur_nom,
  e.nom_complet AS coureur_equipe,
  SUM(pl.points) AS total_points,
  COUNT(DISTINCT pl.course_id) AS courses_count
FROM points_ledger pl
JOIN coureurs c ON c.id = pl.coureur_id
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = pl.coureur_id
LEFT JOIN equipes e ON e.id = cs.equipe_id
GROUP BY pl.phase_id, pl.coureur_id, c.nom, e.nom_complet
ORDER BY SUM(pl.points) DESC;