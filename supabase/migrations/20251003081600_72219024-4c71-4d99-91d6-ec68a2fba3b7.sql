-- Create results_courses_with_entries function
CREATE OR REPLACE FUNCTION public.results_courses_with_entries(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  course_id text,
  nom text,
  categorie text,
  date_debut date,
  date_fin date,
  last_result_at date,
  types text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
WITH rr AS (
  SELECT course_id, MAX(date_classement) AS last_result_at
  FROM race_results
  GROUP BY course_id
),
types AS (
  SELECT course_id, ARRAY_AGG(DISTINCT type_classement::text) AS types
  FROM race_results
  GROUP BY course_id
),
base AS (
  SELECT c.id AS course_id, c.nom, c.categorie, c.date_debut, c.date_fin, rr.last_result_at
  FROM rr
  JOIN courses c ON c.id = rr.course_id
  WHERE (p_search IS NULL OR c.nom ILIKE '%' || p_search || '%')
)
SELECT
  b.course_id, b.nom, b.categorie, b.date_debut, b.date_fin,
  b.last_result_at,
  COALESCE(t.types, ARRAY[]::text[]) AS types
FROM base b
LEFT JOIN types t ON t.course_id = b.course_id
ORDER BY b.last_result_at DESC NULLS LAST, b.date_fin DESC NULLS LAST
LIMIT COALESCE(p_limit, 24)
OFFSET COALESCE(p_offset, 0);
$function$;

-- Create results_course_meta function (improved version)
CREATE OR REPLACE FUNCTION public.results_course_meta_v2(p_course_id text)
RETURNS TABLE(
  course_nom text,
  categorie text,
  date_debut date,
  date_fin date,
  types_disponibles text[],
  etapes_disponibles integer[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
WITH types AS (
  SELECT type_classement::text
  FROM race_results
  WHERE course_id = p_course_id
  GROUP BY type_classement
  ORDER BY type_classement
),
etapes AS (
  SELECT DISTINCT etape_numero
  FROM race_results
  WHERE course_id = p_course_id
    AND type_classement = 'Etape'::type_classement
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
$function$;

-- Create results_course_rows function
CREATE OR REPLACE FUNCTION public.results_course_rows(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero integer DEFAULT NULL
)
RETURNS TABLE(
  row_position integer,
  statut result_statut,
  coureur_id text,
  coureur_nom text,
  equipe text,
  manager_nom text,
  points_officiels bigint,
  points_theoriques integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
WITH co AS (
  SELECT id, categorie, phase_id FROM courses WHERE id = p_course_id
),
rows AS (
  SELECT
    rr.position AS row_position, 
    rr.statut,
    rr.coureur_id, 
    cr.nom AS coureur_nom, 
    cr.equipe,
    m.nom AS manager_nom
  FROM race_results rr
  JOIN coureurs cr ON cr.id = rr.coureur_id
  JOIN co ON co.id = rr.course_id
  LEFT JOIN rosters r
    ON r.coureur_id = rr.coureur_id
   AND r.phase_id = co.phase_id
  LEFT JOIN managers m ON m.id = r.manager_id
  WHERE rr.course_id = p_course_id
    AND rr.type_classement = p_type_classement
    AND (p_type_classement <> 'Etape'::type_classement OR rr.etape_numero = p_etape_numero)
),
pts_off AS (
  SELECT
    pl.coureur_id,
    SUM(pl.points) AS points_officiels
  FROM points_ledger pl
  WHERE pl.course_id = p_course_id
    AND pl.type_classement = p_type_classement
    AND (p_type_classement <> 'Etape'::type_classement OR pl.etape_numero = p_etape_numero)
  GROUP BY pl.coureur_id
)
SELECT
  r.row_position,
  r.statut,
  r.coureur_id,
  r.coureur_nom,
  r.equipe,
  r.manager_nom,
  po.points_officiels,
  CASE
    WHEN r.statut = 'finished'::result_statut AND r.row_position IS NOT NULL THEN COALESCE((
      SELECT sr.points
      FROM courses cx, scoring_rules sr
      WHERE cx.id = p_course_id
        AND sr.categorie = cx.categorie
        AND sr.type_classement = p_type_classement
        AND sr.place = r.row_position
      LIMIT 1
    ), 0)
    ELSE 0
  END AS points_theoriques
FROM rows r
LEFT JOIN pts_off po ON po.coureur_id = r.coureur_id
ORDER BY (r.row_position IS NULL) ASC, r.row_position ASC, r.coureur_nom ASC;
$function$;