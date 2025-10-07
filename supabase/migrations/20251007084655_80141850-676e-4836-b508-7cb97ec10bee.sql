-- Create RPC to get team for any manager (not just current user)
CREATE OR REPLACE FUNCTION public.manager_team_by_id(
  p_manager_id uuid,
  p_phase_id uuid DEFAULT NULL
)
RETURNS TABLE(
  coureur_id text,
  nom text,
  equipe text,
  prix_achat numeric,
  cote_initiale numeric,
  points_total bigint,
  ratio_points_par_prix numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH current_phase AS (
  SELECT COALESCE(p_phase_id, (
    SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
  )) AS phase_id
),
roster AS (
  SELECT r.coureur_id, r.prix_signature
  FROM rosters r, current_phase cp
  WHERE r.phase_id = cp.phase_id
    AND r.manager_id = p_manager_id
),
points AS (
  SELECT 
    pl.coureur_id,
    SUM(pl.points) AS points_total
  FROM points_ledger pl, current_phase cp
  WHERE pl.phase_id = cp.phase_id
    AND pl.manager_id = p_manager_id
  GROUP BY pl.coureur_id
)
SELECT
  r.coureur_id,
  c.nom,
  c.equipe,
  r.prix_signature AS prix_achat,
  c.prix_initial AS cote_initiale,
  COALESCE(p.points_total, 0) AS points_total,
  ROUND(COALESCE(p.points_total, 0)::numeric / NULLIF(r.prix_signature, 0), 2) AS ratio_points_par_prix
FROM roster r
JOIN coureurs c ON c.id = r.coureur_id
LEFT JOIN points p ON p.coureur_id = r.coureur_id
ORDER BY points_total DESC NULLS LAST;
$function$;