-- Mise à jour de results_course_rows pour filtrer par date
CREATE OR REPLACE FUNCTION public.results_course_rows(p_course_id text, p_type_classement type_classement, p_etape_numero integer DEFAULT NULL::integer)
 RETURNS TABLE(row_position integer, statut result_statut, coureur_id text, coureur_nom text, equipe text, manager_nom text, points_officiels bigint, points_theoriques integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH co AS (
  SELECT c.id, c.categorie, c.phase_id, c.date_debut, c.date_fin, p.saison_id 
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE c.id = p_course_id
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
    AND rr.date_classement >= co.date_debut
    AND rr.date_classement <= co.date_fin
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
pts_off AS (
  SELECT
    pl.coureur_id,
    SUM(pl.points) AS points_officiels
  FROM points_ledger pl
  JOIN co ON co.phase_id = pl.phase_id
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
      FROM co
      JOIN scoring_rules_saisons sr 
        ON sr.saison_id = co.saison_id
        AND LOWER(sr.categorie) = LOWER(co.categorie)
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

-- Mise à jour de results_course_meta_v2 pour filtrer par date
CREATE OR REPLACE FUNCTION public.results_course_meta_v2(p_course_id text)
 RETURNS TABLE(course_nom text, categorie text, date_debut date, date_fin date, types_disponibles text[], etapes_disponibles integer[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH types AS (
  SELECT type_classement::text
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  WHERE rr.course_id = p_course_id
    AND rr.date_classement >= c.date_debut
    AND rr.date_classement <= c.date_fin
  GROUP BY type_classement
  ORDER BY type_classement
),
etapes AS (
  SELECT DISTINCT etape_numero
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  WHERE rr.course_id = p_course_id
    AND rr.type_classement = 'Etape'::type_classement
    AND rr.etape_numero IS NOT NULL
    AND rr.date_classement >= c.date_debut
    AND rr.date_classement <= c.date_fin
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

-- Mise à jour de results_course_top pour filtrer par date et phase
CREATE OR REPLACE FUNCTION public.results_course_top(p_course_id text, p_type_classement type_classement, p_etape_numero integer DEFAULT NULL::integer, p_limit integer DEFAULT 10, p_manager_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(row_position integer, statut result_statut, coureur_id text, coureur_nom text, equipe text, manager_id uuid, manager_nom text, points_officiels bigint, points_theoriques integer, points bigint, is_my_rider boolean, has_official_points boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH co AS (
  SELECT c.id, c.categorie, c.phase_id, c.date_debut, c.date_fin, p.saison_id 
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE c.id = p_course_id
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
  JOIN co ON co.id = rr.course_id
  WHERE rr.course_id = p_course_id
    AND rr.type_classement = p_type_classement
    AND rr.date_classement >= co.date_debut
    AND rr.date_classement <= co.date_fin
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
  CROSS JOIN co
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
  JOIN co ON co.phase_id = pl.phase_id
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
        FROM co
        JOIN scoring_rules_saisons sr 
          ON sr.saison_id = co.saison_id
          AND LOWER(sr.categorie) = LOWER(co.categorie)
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