-- CORRECTION SYSTÉMIQUE : Éliminer TOUS les fallbacks vers coureurs.equipe
-- Supprimer get_rider_team_for_season et corriger toutes les fonctions DB

-- 1. Supprimer la fonction problématique
DROP FUNCTION IF EXISTS public.get_rider_team_for_season(text, uuid);

-- 2. Corriger results_course_rows
DROP FUNCTION IF EXISTS public.results_course_rows(text, type_classement, integer);

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
SET search_path TO 'public'
AS $$
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
  COALESCE(cs.equipe, 'N/A') AS equipe,
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
CROSS JOIN co
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = r.coureur_id AND cs.saison_id = co.saison_id
LEFT JOIN pts_off po ON po.coureur_id = r.coureur_id
ORDER BY (r.row_position IS NULL) ASC, r.row_position ASC, r.coureur_nom ASC;
$$;

-- 3. Corriger results_course_top
DROP FUNCTION IF EXISTS public.results_course_top(text, type_classement, integer, integer, uuid);

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
AS $$
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
    cr.nom AS coureur_nom
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
  COALESCE(cs.equipe, 'N/A') AS equipe,
  o.manager_id,
  o.manager_nom,
  of.points_officiels,
  th.points_theoriques,
  COALESCE(of.points_officiels, th.points_theoriques) AS points,
  (COALESCE(p_manager_id, (SELECT m.id FROM managers m WHERE m.user_id = auth.uid() LIMIT 1)) = o.manager_id) AS is_my_rider,
  EXISTS (SELECT 1 FROM points_ledger pl WHERE pl.course_id = p_course_id) AS has_official_points
FROM own o
CROSS JOIN co
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = o.coureur_id AND cs.saison_id = co.saison_id
LEFT JOIN off of ON of.coureur_id = o.coureur_id
LEFT JOIN theo th ON th.coureur_id = o.coureur_id
ORDER BY o.position ASC;
$$;

-- 4. Corriger results_latest_feed
DROP FUNCTION IF EXISTS public.results_latest_feed(integer);

CREATE OR REPLACE FUNCTION public.results_latest_feed(
  p_limit integer DEFAULT 50
)
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
SET search_path TO 'public'
AS $$
WITH base AS (
  SELECT
    rr.id AS race_result_id,
    COALESCE(rr.date_classement, c.date_fin, c.date_debut) AS result_date,
    rr.course_id,
    c.nom AS course_nom,
    c.categorie AS course_categorie,
    c.phase_id,
    p.saison_id,
    rr.type_classement,
    rr.etape_numero,
    rr.coureur_id,
    cr.nom AS coureur_nom,
    rr.position AS row_position,
    rr.statut,
    r.manager_id,
    m.nom AS manager_nom
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
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
  COALESCE(cs.equipe, 'N/A') AS equipe,
  b.row_position,
  b.statut,
  b.manager_id,
  b.manager_nom,
  po.points_officiels,
  COALESCE(po.points_officiels, pt.points_theoriques) AS points_affiches,
  (po.points_officiels IS NOT NULL) AS is_official_points
FROM base b
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = b.coureur_id AND cs.saison_id = b.saison_id
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
$$;

-- 5. Corriger manager_my_team
DROP FUNCTION IF EXISTS public.manager_my_team(uuid);

CREATE OR REPLACE FUNCTION public.manager_my_team(
  p_phase_id uuid DEFAULT NULL
)
RETURNS TABLE(
  coureur_id text,
  nom text,
  equipe text,
  prix_achat numeric,
  cote_initiale numeric,
  points_total bigint,
  ratio_points_par_prix numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH current_phase AS (
  SELECT 
    COALESCE(p_phase_id, (
      SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
    )) AS phase_id,
    p.saison_id
  FROM phases p
  WHERE p.id = COALESCE(p_phase_id, (
    SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
  ))
),
current_manager AS (
  SELECT m.id AS manager_id
  FROM managers m
  WHERE m.user_id = auth.uid()
  LIMIT 1
),
roster AS (
  SELECT r.coureur_id, r.prix_signature
  FROM rosters r, current_phase cp, current_manager cm
  WHERE r.phase_id = cp.phase_id
    AND r.manager_id = cm.manager_id
),
points AS (
  SELECT 
    pl.coureur_id,
    SUM(pl.points) AS points_total
  FROM points_ledger pl, current_phase cp, current_manager cm
  WHERE pl.phase_id = cp.phase_id
    AND pl.manager_id = cm.manager_id
  GROUP BY pl.coureur_id
)
SELECT
  r.coureur_id,
  c.nom,
  COALESCE(cs.equipe, 'N/A') AS equipe,
  r.prix_signature AS prix_achat,
  COALESCE(cs.prix_initial, 10) AS cote_initiale,
  COALESCE(p.points_total, 0) AS points_total,
  ROUND(COALESCE(p.points_total, 0)::numeric / NULLIF(r.prix_signature, 0), 2) AS ratio_points_par_prix
FROM roster r
JOIN coureurs c ON c.id = r.coureur_id
CROSS JOIN current_phase cp
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = cp.saison_id
LEFT JOIN points p ON p.coureur_id = r.coureur_id
ORDER BY points_total DESC NULLS LAST;
$$;

-- 6. Corriger manager_team_by_id
DROP FUNCTION IF EXISTS public.manager_team_by_id(uuid, uuid);

CREATE OR REPLACE FUNCTION public.manager_team_by_id(
  p_manager_id uuid,
  p_phase_id uuid DEFAULT NULL
)
RETURNS TABLE(
  coureur_id text,
  nom text,
  equipe text,
  prix_achat numeric,
  cote_initiale numeric,
  points_total bigint,
  ratio_points_par_prix numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH current_phase AS (
  SELECT 
    COALESCE(p_phase_id, (
      SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
    )) AS phase_id,
    p.saison_id
  FROM phases p
  WHERE p.id = COALESCE(p_phase_id, (
    SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
  ))
),
roster AS (
  SELECT r.coureur_id, r.prix_signature
  FROM rosters r, current_phase cp
  WHERE r.phase_id = cp.phase_id
    AND r.manager_id = p_manager_id
),
points AS (
  SELECT 
    pl.coureur_id,
    SUM(pl.points) AS points_total
  FROM points_ledger pl, current_phase cp
  WHERE pl.phase_id = cp.phase_id
    AND pl.manager_id = p_manager_id
  GROUP BY pl.coureur_id
)
SELECT
  r.coureur_id,
  c.nom,
  COALESCE(cs.equipe, 'N/A') AS equipe,
  r.prix_signature AS prix_achat,
  COALESCE(cs.prix_initial, 10) AS cote_initiale,
  COALESCE(p.points_total, 0) AS points_total,
  ROUND(COALESCE(p.points_total, 0)::numeric / NULLIF(r.prix_signature, 0), 2) AS ratio_points_par_prix
FROM roster r
JOIN coureurs c ON c.id = r.coureur_id
CROSS JOIN current_phase cp
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = cp.saison_id
LEFT JOIN points p ON p.coureur_id = r.coureur_id
ORDER BY points_total DESC NULLS LAST;
$$;