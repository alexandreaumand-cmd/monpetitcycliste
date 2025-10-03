-- Function: results_recent_races
CREATE OR REPLACE FUNCTION results_recent_races(
  p_saison_id uuid DEFAULT NULL,
  p_phase_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 12,
  p_manager_id uuid DEFAULT NULL
)
RETURNS TABLE (
  course_id text,
  nom text,
  categorie text,
  date_debut date,
  date_fin date,
  phase_id uuid,
  last_result_at date,
  types type_classement[],
  my_points bigint,
  has_points boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH rr AS (
    SELECT race_results.course_id, MAX(race_results.date_classement) AS last_result_at
    FROM race_results
    GROUP BY race_results.course_id
  ),
  base AS (
    SELECT c.id AS course_id,
           c.nom,
           c.categorie,
           c.date_debut,
           c.date_fin,
           c.phase_id,
           rr.last_result_at
    FROM rr
    JOIN courses c ON c.id = rr.course_id
    WHERE (p_phase_id IS NULL OR c.phase_id = p_phase_id)
      AND (p_saison_id IS NULL OR c.phase_id IN (
            SELECT p.id FROM phases p WHERE p.saison_id = p_saison_id
          ))
      AND (p_search IS NULL OR c.nom ILIKE '%' || p_search || '%')
  ),
  types AS (
    SELECT r.course_id,
           ARRAY_AGG(DISTINCT r.type_classement) AS types
    FROM race_results r
    GROUP BY r.course_id
  ),
  my_pts AS (
    SELECT pl.course_id, SUM(pl.points) AS my_points
    FROM points_ledger pl
    WHERE p_manager_id IS NOT NULL AND pl.manager_id = p_manager_id
    GROUP BY pl.course_id
  )
  SELECT b.course_id, b.nom, b.categorie, b.date_debut, b.date_fin, b.phase_id,
         b.last_result_at,
         COALESCE(t.types, ARRAY[]::type_classement[]) AS types,
         COALESCE(mp.my_points, 0) AS my_points,
         EXISTS (SELECT 1 FROM points_ledger pl WHERE pl.course_id = b.course_id) AS has_points
  FROM base b
  LEFT JOIN types t ON t.course_id = b.course_id
  LEFT JOIN my_pts mp ON mp.course_id = b.course_id
  ORDER BY b.last_result_at DESC NULLS LAST, b.date_fin DESC NULLS LAST
  LIMIT COALESCE(p_limit, 12);
$$;

-- Function: results_course_table
CREATE OR REPLACE FUNCTION results_course_table(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero int DEFAULT NULL,
  p_manager_id uuid DEFAULT NULL
)
RETURNS TABLE (
  race_result_id uuid,
  row_position int,
  statut result_statut,
  coureur_id text,
  coureur_nom text,
  equipe text,
  manager_id uuid,
  manager_nom text,
  points_theoriques int,
  points_officiels bigint,
  is_my_rider boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH co AS (
    SELECT c.id, c.phase_id, c.categorie, c.nom, c.date_debut, c.date_fin
    FROM courses c
    WHERE c.id = p_course_id
  ),
  rows AS (
    SELECT rr.id AS race_result_id,
           rr.position AS row_position,
           rr.statut,
           rr.coureur_id,
           c.nom AS coureur_nom,
           c.equipe,
           r.manager_id,
           m.nom AS manager_nom
    FROM race_results rr
    JOIN coureurs c ON c.id = rr.coureur_id
    JOIN co ON co.id = rr.course_id
    LEFT JOIN rosters r
      ON r.coureur_id = rr.coureur_id
     AND r.phase_id = co.phase_id
    LEFT JOIN managers m ON m.id = r.manager_id
    WHERE rr.course_id = p_course_id
      AND rr.type_classement = p_type_classement
      AND (p_type_classement::text <> 'Etape' OR rr.etape_numero = p_etape_numero)
  ),
  pts_theo AS (
    SELECT ro.race_result_id,
           CASE
             WHEN ro.statut = 'finished' AND ro.row_position IS NOT NULL THEN
               COALESCE((
                 SELECT sr.points
                 FROM courses cx, scoring_rules sr
                 WHERE cx.id = p_course_id
                   AND sr.categorie = cx.categorie
                   AND sr.type_classement = p_type_classement
                   AND sr.place = ro.row_position
                 LIMIT 1
               ), 0)
             ELSE 0
           END AS points_theoriques
    FROM rows ro
  )
  SELECT ro.race_result_id,
         ro.row_position,
         ro.statut,
         ro.coureur_id,
         ro.coureur_nom,
         ro.equipe,
         ro.manager_id,
         ro.manager_nom,
         pt.points_theoriques,
         COALESCE((
           SELECT SUM(pl.points) FROM points_ledger pl
           WHERE pl.course_id = p_course_id
             AND pl.coureur_id = ro.coureur_id
             AND (pl.manager_id = ro.manager_id OR ro.manager_id IS NULL)
             AND pl.type_classement = p_type_classement
             AND (p_type_classement::text <> 'Etape' OR pl.etape_numero = p_etape_numero)
         ), NULL) AS points_officiels,
         (p_manager_id IS NOT NULL AND ro.manager_id = p_manager_id) AS is_my_rider
  FROM rows ro
  LEFT JOIN pts_theo pt ON pt.race_result_id = ro.race_result_id
  ORDER BY (ro.row_position IS NULL) ASC, ro.row_position ASC, ro.coureur_nom ASC;
$$;

-- Function: results_course_meta
CREATE OR REPLACE FUNCTION results_course_meta(p_course_id text)
RETURNS TABLE (
  course_nom text,
  categorie text,
  date_debut date,
  date_fin date,
  types_disponibles type_classement[],
  etapes_disponibles int[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH types AS (
    SELECT type_classement, COUNT(*) AS n
    FROM race_results
    WHERE course_id = p_course_id
    GROUP BY type_classement
  ),
  etapes AS (
    SELECT DISTINCT etape_numero
    FROM race_results
    WHERE course_id = p_course_id
      AND type_classement = 'Etape'
      AND etape_numero IS NOT NULL
    ORDER BY etape_numero
  )
  SELECT
    c.nom AS course_nom,
    c.categorie,
    c.date_debut,
    c.date_fin,
    ARRAY(SELECT t.type_classement FROM types t) AS types_disponibles,
    ARRAY(SELECT e.etape_numero FROM etapes e) AS etapes_disponibles
  FROM courses c
  WHERE c.id = p_course_id;
$$;