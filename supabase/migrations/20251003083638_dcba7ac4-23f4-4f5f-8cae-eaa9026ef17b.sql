-- Create results_course_top function
CREATE OR REPLACE FUNCTION public.results_course_top(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero integer DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_manager_id uuid DEFAULT NULL
)
RETURNS TABLE(
  row_position integer,
  statut result_statut,
  coureur_id text,
  coureur_nom text,
  equipe text,
  manager_id uuid,
  manager_nom text,
  points_officiels bigint,
  points_theoriques integer,
  points bigint,
  is_my_rider boolean,
  has_official_points boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH co AS (
  SELECT id, categorie, phase_id FROM courses WHERE id = p_course_id
),
base AS (
  SELECT
    rr.position,
    rr.statut,
    rr.coureur_id,
    cr.nom AS coureur_nom,
    cr.equipe AS equipe
  FROM race_results rr
  JOIN coureurs cr ON cr.id = rr.coureur_id
  WHERE rr.course_id = p_course_id
    AND rr.type_classement = p_type_classement
    AND (p_type_classement <> 'Etape'::type_classement OR rr.etape_numero = p_etape_numero)
    AND rr.statut = 'finished'::result_statut
    AND rr.position IS NOT NULL
  ORDER BY rr.position ASC
  LIMIT COALESCE(p_limit, 10)
),
own AS (
  SELECT
    b.*,
    r.manager_id,
    m.nom AS manager_nom
  FROM base b
  JOIN co ON true
  LEFT JOIN rosters r
    ON r.coureur_id = b.coureur_id
   AND r.phase_id = co.phase_id
  LEFT JOIN managers m ON m.id = r.manager_id
),
off AS (
  SELECT
    pl.coureur_id,
    SUM(pl.points) AS points_officiels
  FROM points_ledger pl
  WHERE pl.course_id = p_course_id
    AND pl.type_classement = p_type_classement
    AND (p_type_classement <> 'Etape'::type_classement OR pl.etape_numero = p_etape_numero)
  GROUP BY pl.coureur_id
),
theo AS (
  SELECT
    o.coureur_id,
    CASE
      WHEN o.position IS NOT NULL THEN COALESCE((
        SELECT sr.points
        FROM courses cx, scoring_rules sr
        WHERE cx.id = p_course_id
          AND sr.categorie = cx.categorie
          AND sr.type_classement = p_type_classement
          AND sr.place = o.position
        LIMIT 1
      ), 0)
      ELSE 0
    END AS points_theoriques
  FROM own o
)
SELECT
  o.position AS row_position,
  o.statut,
  o.coureur_id,
  o.coureur_nom,
  o.equipe,
  o.manager_id,
  o.manager_nom,
  of.points_officiels,
  th.points_theoriques,
  COALESCE(of.points_officiels, th.points_theoriques) AS points,
  (COALESCE(p_manager_id, (SELECT m.id FROM managers m WHERE m.user_id = auth.uid() LIMIT 1)) = o.manager_id) AS is_my_rider,
  EXISTS (SELECT 1 FROM points_ledger pl WHERE pl.course_id = p_course_id) AS has_official_points
FROM own o
LEFT JOIN off of ON of.coureur_id = o.coureur_id
LEFT JOIN theo th ON th.coureur_id = o.coureur_id
ORDER BY o.position ASC;
$function$;