-- Fix results_course_table function to support league filtering and remove manager_id dependency from points_ledger

CREATE OR REPLACE FUNCTION public.results_course_table(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero integer DEFAULT NULL,
  p_manager_id uuid DEFAULT NULL,
  p_league_id uuid DEFAULT NULL
)
RETURNS TABLE(
  race_result_id uuid,
  row_position integer,
  statut result_statut,
  coureur_id text,
  coureur_nom text,
  equipe text,
  manager_id uuid,
  manager_nom text,
  points_theoriques integer,
  points_officiels bigint,
  is_my_rider boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH co AS (
    SELECT c.id, c.categorie, c.phase_id, p.saison_id
    FROM courses c
    JOIN phases p ON p.id = c.phase_id
    WHERE c.id = p_course_id
  ),
  rows AS (
    SELECT
      rr.id AS race_result_id,
      rr.position AS row_position,
      rr.statut,
      rr.coureur_id,
      cou.nom AS coureur_nom,
      COALESCE(cs.equipe, 'N/A') AS equipe,
      r.manager_id,
      m.nom AS manager_nom
    FROM race_results rr
    CROSS JOIN co
    JOIN coureurs cou ON cou.id = rr.coureur_id
    LEFT JOIN coureurs_saisons cs ON cs.coureur_id = cou.id AND cs.saison_id = co.saison_id
    LEFT JOIN rosters r ON r.coureur_id = rr.coureur_id 
      AND r.phase_id = co.phase_id 
      AND (p_league_id IS NULL OR r.league_id = p_league_id)
    LEFT JOIN managers m ON m.id = r.manager_id
    WHERE rr.course_id = p_course_id
      AND rr.type_classement = p_type_classement
      AND (
        (p_etape_numero IS NOT NULL AND rr.etape_numero = p_etape_numero)
        OR (p_etape_numero IS NULL AND rr.etape_numero IS NULL)
      )
  ),
  pts_theo AS (
    SELECT
      ro.coureur_id,
      ro.row_position,
      COALESCE((
        SELECT sr.points
        FROM scoring_rules_saisons sr
        CROSS JOIN co
        WHERE sr.saison_id = co.saison_id
          AND LOWER(sr.categorie) = LOWER(co.categorie)
          AND sr.type_classement = p_type_classement
          AND sr.place = ro.row_position
        LIMIT 1
      ), 0) AS points_theoriques
    FROM rows ro
  )
  SELECT
    ro.race_result_id,
    ro.row_position,
    ro.statut,
    ro.coureur_id,
    ro.coureur_nom,
    ro.equipe,
    ro.manager_id,
    ro.manager_nom,
    COALESCE(pt.points_theoriques, 0) AS points_theoriques,
    COALESCE((
      SELECT SUM(pl.points)
      FROM points_ledger pl
      CROSS JOIN co
      WHERE pl.course_id = p_course_id
        AND pl.coureur_id = ro.coureur_id
        AND pl.type_classement = p_type_classement
        AND pl.phase_id = co.phase_id
        AND (
          (p_etape_numero IS NOT NULL AND pl.etape_numero = p_etape_numero)
          OR (p_etape_numero IS NULL AND pl.etape_numero IS NULL)
        )
    ), 0) AS points_officiels,
    (p_manager_id IS NOT NULL AND ro.manager_id = p_manager_id) AS is_my_rider
  FROM rows ro
  LEFT JOIN pts_theo pt ON pt.coureur_id = ro.coureur_id AND pt.row_position = ro.row_position
  ORDER BY ro.row_position ASC NULLS LAST;
END;
$function$;