-- Fix phase resolution: use course phase instead of active phase

-- 1. Add security constraints (drop first if exists to avoid errors)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_rosters_phase_rider'
  ) THEN
    ALTER TABLE rosters ADD CONSTRAINT uniq_rosters_phase_rider UNIQUE (phase_id, coureur_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rosters_phase_manager 
  ON rosters(phase_id, manager_id);
  
CREATE INDEX IF NOT EXISTS idx_points_ledger_phase_manager 
  ON points_ledger(phase_id, manager_id);

-- 2. Fix results_course_table - use course phase not active phase
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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      AND (p_type_classement <> 'Etape'::type_classement OR rr.etape_numero = p_etape_numero)
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
             AND (p_type_classement <> 'Etape'::type_classement OR pl.etape_numero = p_etape_numero)
         ), NULL) AS points_officiels,
         (p_manager_id IS NOT NULL AND ro.manager_id = p_manager_id) AS is_my_rider
  FROM rows ro
  LEFT JOIN pts_theo pt ON pt.race_result_id = ro.race_result_id
  ORDER BY (ro.row_position IS NULL) ASC, ro.row_position ASC, ro.coureur_nom ASC;
$function$;

-- 3. Fix results_course_rows - use course phase not active phase
CREATE OR REPLACE FUNCTION public.results_course_rows(
  p_course_id text, 
  p_type_classement type_classement, 
  p_etape_numero integer DEFAULT NULL::integer
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

-- 4. Fix results_course_top - use course phase not active phase
CREATE OR REPLACE FUNCTION public.results_course_top(
  p_course_id text, 
  p_type_classement type_classement, 
  p_etape_numero integer DEFAULT NULL::integer, 
  p_limit integer DEFAULT 10, 
  p_manager_id uuid DEFAULT NULL::uuid
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
STABLE SECURITY DEFINER
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

-- 5. Fix results_latest_feed - use course phase not active phase
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
STABLE SECURITY DEFINER
SET search_path TO 'public'
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