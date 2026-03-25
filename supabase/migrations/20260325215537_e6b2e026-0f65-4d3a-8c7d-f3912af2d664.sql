
-- 1) Backfill course_id from commentaire for coureur_bonuse entries
UPDATE bonus_points
SET course_id = regexp_replace(commentaire, '^.*\(25%\) - ([^ ]+) - .*$', '\1')
WHERE bonus_type = 'coureur_bonuse'
  AND (course_id IS NULL OR course_id = '')
  AND commentaire ~ '^\s*Bonus coureur.*\(25%\) - [a-z0-9_-]+ - ';

-- 2) Fix manager_team_by_id: correct equipe join + strict bonus filtering
CREATE OR REPLACE FUNCTION manager_team_by_id(
  p_manager_id uuid,
  p_phase_id uuid DEFAULT NULL,
  p_league_id uuid DEFAULT NULL
)
RETURNS TABLE(
  coureur_id text,
  nom text,
  equipe text,
  prix_achat numeric,
  cote_initiale numeric,
  points_total numeric,
  ratio_points_par_prix numeric,
  winning_round integer
)
LANGUAGE sql STABLE
AS $$
WITH current_phase AS (
  SELECT
    COALESCE(p_phase_id, (SELECT id FROM phases WHERE statut = 'active' ORDER BY date_debut DESC LIMIT 1)) AS phase_id,
    p.saison_id
  FROM phases p
  WHERE p.id = COALESCE(p_phase_id, (SELECT id FROM phases WHERE statut = 'active' ORDER BY date_debut DESC LIMIT 1))
),
league_info AS (
  SELECT COALESCE(started_at_effective, created_at)::date AS effective_start
  FROM leagues
  WHERE id = p_league_id
),
allowed_courses AS (
  SELECT course_id FROM get_league_course_ids(p_league_id)
  WHERE p_league_id IS NOT NULL
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
    AND (p_league_id IS NULL OR pl.course_id IN (SELECT ac.course_id FROM allowed_courses ac))
    AND (p_league_id IS NULL OR pl.course_id IN (
        SELECT c.id FROM courses c, league_info li WHERE c.date_debut >= li.effective_start
    ))
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
    AND (p_league_id IS NULL OR (bp.course_id IS NOT NULL AND bp.course_id != ''
         AND bp.course_id IN (SELECT ac.course_id FROM allowed_courses ac)))
    AND (p_league_id IS NULL OR (bp.course_id IS NOT NULL AND bp.course_id != ''
         AND bp.course_id IN (
           SELECT c.id FROM courses c, league_info li WHERE c.date_debut >= li.effective_start
         )))
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
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = r.coureur_id AND cs.saison_id = cp.saison_id
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cp.saison_id
LEFT JOIN points p ON p.coureur_id = r.coureur_id
LEFT JOIN rider_bonus rb ON rb.coureur_id = r.coureur_id
ORDER BY points_total DESC;
$$;
