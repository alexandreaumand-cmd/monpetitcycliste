
-- Update trigger to include course_id
CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_manager_rec RECORD;
  v_bonus_amount NUMERIC(10,2);
  v_comment TEXT;
  v_already_exists BOOLEAN;
  v_etape_label TEXT;
BEGIN
  IF NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.etape_numero IS NOT NULL AND NEW.etape_numero > 0 THEN
    v_etape_label := ' Etape ' || NEW.etape_numero::text;
  ELSE
    v_etape_label := '';
  END IF;

  FOR v_manager_rec IN
    SELECT
      r.manager_id,
      r.league_id,
      brs.phase_id
    FROM rosters r
    INNER JOIN bonus_rider_selections brs
      ON brs.manager_id = r.manager_id
      AND brs.phase_id = r.phase_id
      AND brs.coureur_id = r.coureur_id
      AND brs.league_id = r.league_id
    WHERE r.coureur_id = NEW.coureur_id
      AND r.phase_id = NEW.phase_id
  LOOP
    v_bonus_amount := ROUND(NEW.points * 0.25, 2);
    v_comment := 'Bonus coureur automatique (25%) - ' || COALESCE(NEW.course_id, 'Course') || ' - ' || NEW.type_classement::text || v_etape_label;

    SELECT EXISTS(
      SELECT 1 FROM bonus_points
      WHERE phase_id = NEW.phase_id
        AND coureur_id = NEW.coureur_id
        AND manager_id = v_manager_rec.manager_id
        AND league_id = v_manager_rec.league_id
        AND bonus_type = 'coureur_bonuse'
        AND commentaire = v_comment
    ) INTO v_already_exists;

    IF NOT v_already_exists THEN
      INSERT INTO bonus_points (
        phase_id, coureur_id, manager_id, league_id,
        bonus_type, points, commentaire, created_by, course_id
      ) VALUES (
        NEW.phase_id, NEW.coureur_id, v_manager_rec.manager_id, v_manager_rec.league_id,
        'coureur_bonuse', v_bonus_amount, v_comment, v_manager_rec.manager_id, NEW.course_id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Update manager_team_by_id with rider_bonus filtering
DROP FUNCTION IF EXISTS public.manager_team_by_id(uuid, uuid, uuid);

CREATE FUNCTION public.manager_team_by_id(p_manager_id uuid, p_phase_id uuid DEFAULT NULL, p_league_id uuid DEFAULT NULL)
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
    AND (p_league_id IS NULL OR bp.course_id IS NULL
         OR bp.course_id IN (SELECT ac.course_id FROM allowed_courses ac))
    AND (p_league_id IS NULL OR bp.course_id IS NULL
         OR bp.course_id IN (
           SELECT c.id FROM courses c, league_info li WHERE c.date_debut >= li.effective_start
         ))
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
LEFT JOIN equipes_saisons es ON es.id = cs.equipe_id AND es.saison_id = cp.saison_id
LEFT JOIN points p ON p.coureur_id = r.coureur_id
LEFT JOIN rider_bonus rb ON rb.coureur_id = r.coureur_id
ORDER BY points_total DESC;
$function$;
