-- Fix results_course_rows to properly filter etape_numero and eliminate duplicates
CREATE OR REPLACE FUNCTION public.results_course_rows(p_course_id text, p_type_classement type_classement, p_etape_numero integer DEFAULT NULL::integer)
 RETURNS TABLE(row_position integer, statut result_statut, coureur_id text, coureur_nom text, equipe text, manager_nom text, points_officiels bigint, points_theoriques integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    AND (
      -- Pour les résultats d'étape, filtrer sur l'étape demandée
      (p_type_classement = 'Etape'::type_classement AND rr.etape_numero = p_etape_numero)
      OR
      -- Pour les autres classements :
      (p_type_classement <> 'Etape'::type_classement AND (
        -- Si p_etape_numero est NULL, prendre seulement les résultats finaux
        (p_etape_numero IS NULL AND rr.etape_numero IS NULL)
        OR
        -- Si p_etape_numero est fourni, prendre les leaders à cette étape
        (p_etape_numero IS NOT NULL AND rr.etape_numero = p_etape_numero)
      ))
    )
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