-- Fix manager_my_team function to properly join with rosters for manager_id
DROP FUNCTION IF EXISTS public.manager_my_team(uuid);

CREATE OR REPLACE FUNCTION public.manager_my_team(p_phase_id uuid DEFAULT NULL::uuid)
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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH current_phase AS (
  SELECT 
    COALESCE(p_phase_id, (
      SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
    )) AS phase_id,
    p.saison_id
  FROM phases p
  WHERE p.id = COALESCE(p_phase_id, (
    SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
  ))
),
current_manager AS (
  SELECT m.id AS manager_id
  FROM managers m
  WHERE m.user_id = auth.uid()
  LIMIT 1
),
roster AS (
  SELECT r.coureur_id, r.prix_signature
  FROM rosters r, current_phase cp, current_manager cm
  WHERE r.phase_id = cp.phase_id
    AND r.manager_id = cm.manager_id
),
points AS (
  SELECT 
    pl.coureur_id,
    SUM(pl.points) AS points_total
  FROM points_ledger pl
  CROSS JOIN current_phase cp
  CROSS JOIN current_manager cm
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id AND r.manager_id = cm.manager_id
  WHERE pl.phase_id = cp.phase_id
  GROUP BY pl.coureur_id
)
SELECT
  r.coureur_id,
  c.nom,
  COALESCE(es.nom_affiche, 'N/A') AS equipe,
  r.prix_signature AS prix_achat,
  COALESCE(cs.prix_initial, 10) AS cote_initiale,
  COALESCE(p.points_total, 0) AS points_total,
  ROUND(COALESCE(p.points_total, 0)::numeric / NULLIF(r.prix_signature, 0), 2) AS ratio_points_par_prix
FROM roster r
JOIN coureurs c ON c.id = r.coureur_id
CROSS JOIN current_phase cp
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = cp.saison_id
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cp.saison_id
LEFT JOIN points p ON p.coureur_id = r.coureur_id
ORDER BY points_total DESC NULLS LAST;
$function$;