-- Supprimer l'ancienne fonction pour pouvoir changer le type de retour
DROP FUNCTION IF EXISTS public.manager_team_by_id(uuid, uuid, uuid);

-- Recréer la fonction avec winning_round
CREATE OR REPLACE FUNCTION public.manager_team_by_id(
  p_manager_id uuid,
  p_phase_id uuid DEFAULT NULL::uuid,
  p_league_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  coureur_id text,
  nom text,
  equipe text,
  prix_achat numeric,
  cote_initiale numeric,
  points_total bigint,
  ratio_points_par_prix numeric,
  winning_round integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH current_phase AS (
  SELECT 
    COALESCE(p_phase_id, (SELECT id FROM phases WHERE statut = 'active' ORDER BY date_debut DESC LIMIT 1)) AS phase_id,
    p.saison_id
  FROM phases p
  WHERE p.id = COALESCE(p_phase_id, (SELECT id FROM phases WHERE statut = 'active' ORDER BY date_debut DESC LIMIT 1))
),
roster AS (
  SELECT r.coureur_id, r.prix_signature, a.round_number
  FROM rosters r
  CROSS JOIN current_phase cp
  LEFT JOIN annonces a ON a.coureur_id = r.coureur_id 
                       AND a.winning_manager_id = p_manager_id
                       AND a.auction_id IN (
                         SELECT au.id FROM auctions au 
                         WHERE au.phase_id = cp.phase_id 
                           AND (p_league_id IS NULL OR au.league_id = p_league_id)
                       )
  WHERE r.phase_id = cp.phase_id
    AND r.manager_id = p_manager_id
    AND (p_league_id IS NULL OR r.league_id = p_league_id)
),
points AS (
  SELECT pl.coureur_id, SUM(pl.points) AS points_total
  FROM points_ledger pl
  INNER JOIN roster r ON r.coureur_id = pl.coureur_id
  CROSS JOIN current_phase cp
  WHERE pl.phase_id = cp.phase_id
  GROUP BY pl.coureur_id
),
rider_bonus AS (
  SELECT bp.coureur_id, SUM(bp.points) AS bonus_points
  FROM bonus_points bp
  CROSS JOIN current_phase cp
  WHERE bp.phase_id = cp.phase_id
    AND (bp.manager_id = p_manager_id OR bp.target_manager_id = p_manager_id)
    AND bp.coureur_id IS NOT NULL
    AND (p_league_id IS NULL OR bp.league_id = p_league_id)
  GROUP BY bp.coureur_id
)
SELECT
  r.coureur_id,
  c.nom,
  COALESCE(es.nom_affiche, 'N/A') AS equipe,
  r.prix_signature AS prix_achat,
  COALESCE(cs.prix_initial, 10) AS cote_initiale,
  COALESCE(p.points_total, 0) + COALESCE(rb.bonus_points, 0) AS points_total,
  ROUND((COALESCE(p.points_total, 0) + COALESCE(rb.bonus_points, 0))::numeric / NULLIF(r.prix_signature, 0), 2) AS ratio_points_par_prix,
  r.round_number AS winning_round
FROM roster r
JOIN coureurs c ON c.id = r.coureur_id
CROSS JOIN current_phase cp
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = cp.saison_id
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cp.saison_id
LEFT JOIN points p ON p.coureur_id = r.coureur_id
LEFT JOIN rider_bonus rb ON rb.coureur_id = r.coureur_id
ORDER BY points_total DESC NULLS LAST;
$function$;