-- Create results_latest_feed function (optional feed view)
CREATE OR REPLACE FUNCTION public.results_latest_feed(p_limit integer DEFAULT 50)
RETURNS TABLE(
  result_date date,
  course_id text,
  course_nom text,
  course_categorie text,
  type_classement type_classement,
  etape_numero integer,
  coureur_id text,
  coureur_nom text,
  equipe text,
  row_position integer,
  statut result_statut,
  manager_id uuid,
  manager_nom text,
  points_officiels bigint,
  points_affiches bigint,
  is_official_points boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
WITH base AS (
  SELECT
    rr.id AS race_result_id,
    COALESCE(rr.date_classement, c.date_fin, c.date_debut) AS result_date,
    rr.course_id,
    c.nom AS course_nom,
    c.categorie AS course_categorie,
    c.phase_id,
    rr.type_classement,
    rr.etape_numero,
    rr.coureur_id,
    cr.nom AS coureur_nom,
    cr.equipe AS equipe,
    rr.position AS row_position,
    rr.statut,
    r.manager_id,
    m.nom AS manager_nom
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN coureurs cr ON cr.id = rr.coureur_id
  LEFT JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  LEFT JOIN managers m ON m.id = r.manager_id
),
pts_off AS (
  SELECT
    pl.course_id,
    pl.type_classement,
    pl.etape_numero,
    pl.coureur_id,
    pl.manager_id,
    SUM(pl.points) AS points_officiels
  FROM points_ledger pl
  GROUP BY pl.course_id, pl.type_classement, pl.etape_numero, pl.coureur_id, pl.manager_id
),
pts_theo AS (
  SELECT
    b.course_id,
    b.type_classement,
    b.etape_numero,
    b.coureur_id,
    CASE
      WHEN b.statut = 'finished'::result_statut AND b.row_position IS NOT NULL THEN COALESCE((
        SELECT sr.points
        FROM scoring_rules sr
        WHERE sr.categorie = b.course_categorie
          AND sr.type_classement = b.type_classement
          AND sr.place = b.row_position
        LIMIT 1
      ), 0)
      ELSE 0
    END AS points_theoriques
  FROM base b
)
SELECT
  b.result_date,
  b.course_id,
  b.course_nom,
  b.course_categorie,
  b.type_classement,
  b.etape_numero,
  b.coureur_id,
  b.coureur_nom,
  b.equipe,
  b.row_position,
  b.statut,
  b.manager_id,
  b.manager_nom,
  po.points_officiels,
  COALESCE(po.points_officiels, pt.points_theoriques) AS points_affiches,
  (po.points_officiels IS NOT NULL) AS is_official_points
FROM base b
LEFT JOIN pts_off po
  ON po.course_id = b.course_id
 AND po.type_classement = b.type_classement
 AND (b.type_classement <> 'Etape'::type_classement OR po.etape_numero = b.etape_numero)
 AND po.coureur_id = b.coureur_id
 AND (po.manager_id = b.manager_id OR b.manager_id IS NULL)
LEFT JOIN pts_theo pt
  ON pt.course_id = b.course_id
 AND pt.type_classement = b.type_classement
 AND (b.type_classement <> 'Etape'::type_classement OR pt.etape_numero = b.etape_numero)
 AND pt.coureur_id = b.coureur_id
ORDER BY b.result_date DESC NULLS LAST,
         b.type_classement,
         CASE WHEN b.row_position IS NULL THEN 1 ELSE 0 END,
         b.row_position ASC,
         b.coureur_nom ASC
LIMIT COALESCE(p_limit, 50);
$function$;