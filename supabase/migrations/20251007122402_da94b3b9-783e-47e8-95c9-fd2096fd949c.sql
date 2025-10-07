-- 1) Update results_course_table to correctly filter etape_numero for non-'Etape' classifications
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
      AND (
        -- Etape: filtrer sur l'etape demandee
        (p_type_classement = 'Etape'::type_classement AND rr.etape_numero = p_etape_numero)
        OR
        -- Autres classements: soit final (NULL), soit leaders a une etape precise
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
$$;

-- 2) Deduplicate existing finished results keeping the most recent per key
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY course_id, type_classement, COALESCE(etape_numero, -1), position
           ORDER BY updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM race_results
  WHERE statut = 'finished' AND position IS NOT NULL
)
DELETE FROM race_results rr
USING ranked r
WHERE rr.id = r.id AND r.rn > 1;

-- 3) Prevent future duplicates with partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_race_results_final_unique
  ON public.race_results (course_id, type_classement, position)
  WHERE etape_numero IS NULL AND statut = 'finished';

CREATE UNIQUE INDEX IF NOT EXISTS uq_race_results_stage_unique
  ON public.race_results (course_id, type_classement, etape_numero, position)
  WHERE etape_numero IS NOT NULL AND statut = 'finished';