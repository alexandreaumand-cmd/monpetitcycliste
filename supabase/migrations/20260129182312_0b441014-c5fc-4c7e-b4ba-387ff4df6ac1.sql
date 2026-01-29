-- Fix results_course_top to handle NUMERIC points from points_ledger
DROP FUNCTION IF EXISTS public.results_course_top(text, type_classement, integer, integer);

CREATE FUNCTION results_course_top(
  p_course_id TEXT,
  p_type_classement type_classement,
  p_etape_numero INT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  coureur_id TEXT,
  coureur_nom TEXT,
  coureur_equipe TEXT,
  "position" INT,
  points NUMERIC,
  statut result_statut,
  has_official_points BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_results AS (
    SELECT
      rr.coureur_id,
      c.nom AS coureur_nom,
      es.nom_affiche AS coureur_equipe,
      rr."position",
      COALESCE(pl.points, 0) AS points,
      rr.statut,
      (pl.points IS NOT NULL) AS has_official_points,
      ROW_NUMBER() OVER (
        PARTITION BY rr.coureur_id
        ORDER BY rr.updated_at DESC
      ) AS rn
    FROM race_results rr
    LEFT JOIN coureurs c ON c.id = rr.coureur_id
    LEFT JOIN courses co ON co.id = rr.course_id
    LEFT JOIN phases p ON p.id = co.phase_id
    LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = p.saison_id
    LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = p.saison_id
    LEFT JOIN points_ledger pl ON
      pl.course_id = rr.course_id
      AND pl.coureur_id = rr.coureur_id
      AND pl.type_classement = rr.type_classement
      AND (
        (rr.type_classement = 'Etape' AND pl.etape_numero = rr.etape_numero)
        OR (rr.type_classement != 'Etape' AND pl.etape_numero IS NULL)
      )
    WHERE rr.course_id = p_course_id
      AND rr.type_classement = p_type_classement
      AND (
        (p_etape_numero IS NULL AND rr.etape_numero IS NULL)
        OR (p_etape_numero IS NOT NULL AND rr.etape_numero = p_etape_numero)
      )
      AND rr.statut = 'finished'
      AND rr."position" IS NOT NULL
  )
  SELECT
    r.coureur_id,
    r.coureur_nom,
    r.coureur_equipe,
    r."position",
    r.points,
    r.statut,
    r.has_official_points
  FROM ranked_results r
  WHERE r.rn = 1
  ORDER BY r."position" ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public';