-- Fix results_course_top function to use correct result_statut enum values
CREATE OR REPLACE FUNCTION public.results_course_top(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero integer DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  row_position integer,
  coureur_id text,
  coureur_nom text,
  equipe text,
  points_theoriques integer,
  points_officiels bigint,
  has_official_points boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saison_id uuid;
  v_categorie text;
BEGIN
  -- Get course metadata
  SELECT p.saison_id, c.categorie
  INTO v_saison_id, v_categorie
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE c.id = p_course_id;

  IF v_saison_id IS NULL THEN
    RAISE EXCEPTION 'Course % not found or has no season', p_course_id;
  END IF;

  RETURN QUERY
  WITH rr AS (
    SELECT
      rr.position AS row_position,
      rr.coureur_id,
      rr.statut,
      rr.points
    FROM race_results rr
    WHERE rr.course_id = p_course_id
      AND rr.type_classement = p_type_classement
      AND (
        (p_etape_numero IS NOT NULL AND rr.etape_numero = p_etape_numero)
        OR (p_etape_numero IS NULL AND rr.etape_numero IS NULL)
      )
      AND rr.position IS NOT NULL
  ),
  enriched AS (
    SELECT
      rr.row_position,
      rr.coureur_id,
      c.nom AS coureur_nom,
      COALESCE(es.display_name, cs.equipe, 'N/A') AS equipe,
      COALESCE((
        SELECT sr.points
        FROM scoring_rules_saisons sr
        WHERE sr.saison_id = v_saison_id
          AND LOWER(sr.categorie) = LOWER(v_categorie)
          AND sr.type_classement = p_type_classement
          AND sr.place = rr.row_position
        LIMIT 1
      ), 0) AS points_theoriques,
      SUM(CASE WHEN rr.statut = 'finished' THEN rr.points ELSE 0 END) OVER (PARTITION BY rr.coureur_id) AS points_officiels,
      CASE WHEN rr.statut = 'finished' THEN true ELSE false END AS has_official_points
    FROM rr
    JOIN coureurs c ON c.id = rr.coureur_id
    LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = v_saison_id
    LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe AND es.saison_id = v_saison_id
  )
  SELECT
    e.row_position,
    e.coureur_id,
    e.coureur_nom,
    e.equipe,
    e.points_theoriques,
    e.points_officiels,
    e.has_official_points
  FROM enriched e
  WHERE e.row_position IS NOT NULL
    AND rr.statut IN ('finished', 'dnf', 'dns')
  ORDER BY e.row_position ASC
  LIMIT COALESCE(p_limit, 10);
END;
$function$;