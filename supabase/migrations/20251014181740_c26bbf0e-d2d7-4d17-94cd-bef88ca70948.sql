-- Corriger results_course_table pour utiliser coureurs_saisons
CREATE OR REPLACE FUNCTION public.results_course_table(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero integer DEFAULT NULL::integer,
  p_manager_id uuid DEFAULT NULL::uuid
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH co AS (
  SELECT c.id, c.phase_id, c.categorie, c.nom, c.date_debut, c.date_fin, p.saison_id
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE c.id = p_course_id
),
rows AS (
  SELECT rr.id AS race_result_id,
         rr.position AS row_position,
         rr.statut,
         rr.coureur_id,
         c.nom AS coureur_nom,
         COALESCE(cs.equipe, 'N/A') AS equipe,
         r.manager_id,
         m.nom AS manager_nom
  FROM race_results rr
  JOIN coureurs c ON c.id = rr.coureur_id
  JOIN co ON co.id = rr.course_id
  LEFT JOIN coureurs_saisons cs
    ON cs.coureur_id = c.id
    AND cs.saison_id = co.saison_id
  LEFT JOIN rosters r
    ON r.coureur_id = rr.coureur_id
    AND r.phase_id = co.phase_id
  LEFT JOIN managers m ON m.id = r.manager_id
  WHERE rr.course_id = p_course_id
    AND rr.type_classement = p_type_classement
    AND (
      (p_type_classement = 'Etape'::type_classement AND rr.etape_numero = p_etape_numero)
      OR
      (p_type_classement <> 'Etape'::type_classement AND (
        (p_etape_numero IS NULL AND rr.etape_numero IS NULL)
        OR
        (p_etape_numero IS NOT NULL AND rr.etape_numero = p_etape_numero)
      ))
    )
),
pts_theo AS (
  SELECT ro.race_result_id,
         CASE
           WHEN ro.statut = 'finished'::result_statut AND ro.row_position IS NOT NULL THEN
             COALESCE((
               SELECT sr.points
               FROM co
               JOIN scoring_rules_saisons sr 
                 ON sr.saison_id = co.saison_id
                 AND LOWER(sr.categorie) = LOWER(co.categorie)
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
           AND (
             (p_type_classement = 'Etape'::type_classement AND pl.etape_numero = p_etape_numero)
             OR
             (p_type_classement <> 'Etape'::type_classement AND (
               (p_etape_numero IS NULL AND pl.etape_numero IS NULL)
               OR
               (p_etape_numero IS NOT NULL AND pl.etape_numero = p_etape_numero)
             ))
           )
       ), NULL) AS points_officiels,
       (p_manager_id IS NOT NULL AND ro.manager_id = p_manager_id) AS is_my_rider
FROM rows ro
LEFT JOIN pts_theo pt ON pt.race_result_id = ro.race_result_id
ORDER BY (ro.row_position IS NULL) ASC, ro.row_position ASC, ro.coureur_nom ASC;
$function$;