-- ==========================================
-- Phase 1.1: Création des tables d'historisation
-- ==========================================

-- Table coureurs_saisons
CREATE TABLE coureurs_saisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coureur_id TEXT NOT NULL REFERENCES coureurs(id) ON DELETE CASCADE,
  saison_id UUID NOT NULL REFERENCES saisons(id) ON DELETE CASCADE,
  equipe TEXT,
  prix_initial NUMERIC DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coureur_id, saison_id)
);

-- Index pour performance
CREATE INDEX idx_coureurs_saisons_coureur ON coureurs_saisons(coureur_id);
CREATE INDEX idx_coureurs_saisons_saison ON coureurs_saisons(saison_id);
CREATE INDEX idx_coureurs_saisons_lookup ON coureurs_saisons(coureur_id, saison_id);

-- RLS policies
ALTER TABLE coureurs_saisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view coureurs_saisons"
  ON coureurs_saisons FOR SELECT
  USING (true);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_coureurs_saisons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER coureurs_saisons_updated_at
  BEFORE UPDATE ON coureurs_saisons
  FOR EACH ROW
  EXECUTE FUNCTION update_coureurs_saisons_updated_at();

-- Table scoring_rules_saisons
CREATE TABLE scoring_rules_saisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saison_id UUID NOT NULL REFERENCES saisons(id) ON DELETE CASCADE,
  categorie TEXT NOT NULL,
  type_classement type_classement NOT NULL,
  place INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(saison_id, categorie, type_classement, place)
);

-- Index pour performance
CREATE INDEX idx_scoring_rules_saisons_saison ON scoring_rules_saisons(saison_id);
CREATE INDEX idx_scoring_rules_saisons_lookup ON scoring_rules_saisons(saison_id, categorie, type_classement, place);

-- RLS policies
ALTER TABLE scoring_rules_saisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view scoring_rules_saisons"
  ON scoring_rules_saisons FOR SELECT
  USING (true);

-- ==========================================
-- Phase 1.2: Migration données 2025
-- ==========================================

-- Migrer coureurs vers saison 2025
INSERT INTO coureurs_saisons (coureur_id, saison_id, equipe, prix_initial)
SELECT 
  c.id,
  s.id,
  c.equipe,
  c.prix_initial
FROM coureurs c
CROSS JOIN saisons s
WHERE s.annee = 2025
ON CONFLICT (coureur_id, saison_id) DO UPDATE SET
  equipe = EXCLUDED.equipe,
  prix_initial = EXCLUDED.prix_initial;

-- Migrer barèmes vers saison 2025
INSERT INTO scoring_rules_saisons (saison_id, categorie, type_classement, place, points, type)
SELECT 
  s.id,
  sr.categorie,
  sr.type_classement,
  sr.place,
  sr.points,
  sr.type
FROM scoring_rules sr
CROSS JOIN saisons s
WHERE s.annee = 2025
ON CONFLICT (saison_id, categorie, type_classement, place) DO UPDATE SET
  points = EXCLUDED.points,
  type = EXCLUDED.type;

-- ==========================================
-- Phase 1.3: Adapter vue coureurs_disponibilite
-- ==========================================

DROP VIEW IF EXISTS coureurs_disponibilite CASCADE;

CREATE OR REPLACE VIEW coureurs_disponibilite AS
SELECT 
  p.id AS phase_id,
  c.id AS coureur_id,
  c.nom AS coureur_nom,
  COALESCE(cs.equipe, c.equipe) AS coureur_equipe,
  COALESCE(cs.prix_initial, c.prix_initial) AS prix_initial,
  EXISTS (
    SELECT 1 FROM rosters r 
    WHERE r.coureur_id = c.id AND r.phase_id = p.id
  ) AS is_taken,
  (
    SELECT m.nom FROM rosters r 
    JOIN managers m ON m.id = r.manager_id 
    WHERE r.coureur_id = c.id AND r.phase_id = p.id 
    LIMIT 1
  ) AS taken_by_manager_nom,
  LOWER(unaccent(c.nom || ' ' || COALESCE(cs.equipe, c.equipe, ''))) AS search_text
FROM coureurs c
CROSS JOIN phases p
LEFT JOIN coureurs_saisons cs 
  ON cs.coureur_id = c.id 
  AND cs.saison_id = p.saison_id;

-- ==========================================
-- Phase 1.4: Adapter fonction admin_compute_points_for_course
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_compute_points_for_course(p_course_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_course_categorie text;
  v_course_phase_id uuid;
  v_course_saison_id uuid;
  v_manager_id uuid;
  v_rows_inserted int := 0;
  v_missing_bareme jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  SELECT id INTO v_manager_id FROM managers WHERE user_id = auth.uid() LIMIT 1;

  SELECT c.categorie, c.phase_id, p.saison_id
  INTO v_course_categorie, v_course_phase_id, v_course_saison_id
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE c.id = p_course_id;

  IF v_course_categorie IS NULL THEN
    RAISE EXCEPTION 'Course not found: %', p_course_id;
  END IF;

  WITH joined AS (
    SELECT DISTINCT
      LOWER(c.categorie) AS categorie_norm,
      rr.type_classement,
      rr.position AS place
    FROM race_results rr
    JOIN courses c ON c.id = rr.course_id
    WHERE rr.course_id = p_course_id
      AND rr.statut = 'finished'
      AND rr.position IS NOT NULL
      AND (
        rr.type_classement = 'Etape'::type_classement
        OR rr.type_classement::text LIKE 'Porteur%'
        OR rr.etape_numero IS NULL
      )
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'categorie', j.categorie_norm,
      'type_classement', j.type_classement::text,
      'place', j.place
    )
  )
  INTO v_missing_bareme
  FROM joined j
  LEFT JOIN scoring_rules_saisons sr
    ON sr.saison_id = v_course_saison_id
   AND LOWER(sr.categorie) = j.categorie_norm
   AND sr.type_classement = j.type_classement
   AND sr.place = j.place
  WHERE sr.points IS NULL;

  WITH co AS (
    SELECT id, LOWER(categorie) AS categorie_norm, phase_id FROM courses WHERE id = p_course_id
  ),
  base AS (
    SELECT
      rr.type_classement,
      rr.etape_numero,
      rr.coureur_id,
      rr.position,
      rr.statut
    FROM race_results rr
    WHERE rr.course_id = p_course_id
  ),
  eligible AS (
    SELECT * FROM base
    WHERE statut = 'finished' 
      AND position IS NOT NULL
      AND (
        type_classement = 'Etape'::type_classement
        OR type_classement::text LIKE 'Porteur%'
        OR etape_numero IS NULL
      )
  ),
  joined AS (
    SELECT
      e.type_classement,
      e.etape_numero,
      e.coureur_id,
      e.position,
      co.categorie_norm,
      co.phase_id,
      co.id AS course_id,
      r.manager_id
    FROM eligible e
    CROSS JOIN co
    LEFT JOIN rosters r
      ON r.coureur_id = e.coureur_id
     AND r.phase_id = co.phase_id
  ),
  scored AS (
    SELECT
      j.*,
      COALESCE((
        SELECT sr.points
        FROM scoring_rules_saisons sr
        WHERE sr.saison_id = v_course_saison_id
          AND LOWER(sr.categorie) = j.categorie_norm
          AND sr.type_classement = j.type_classement
          AND sr.place = j.position
        LIMIT 1
      ), 0) AS points
    FROM joined j
    WHERE j.manager_id IS NOT NULL
  )
  INSERT INTO points_ledger
    (phase_id, course_id, manager_id, coureur_id, type_classement, etape_numero, points)
  SELECT
    s.phase_id, s.course_id, s.manager_id, s.coureur_id,
    s.type_classement, s.etape_numero, s.points
  FROM scored s
  ON CONFLICT (course_id, type_classement, COALESCE(etape_numero,-1), coureur_id, manager_id)
  DO UPDATE SET points = EXCLUDED.points;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  WITH co AS (
    SELECT id, phase_id FROM courses WHERE id = p_course_id
  ),
  eligible AS (
    SELECT
      rr.type_classement,
      rr.etape_numero,
      rr.coureur_id,
      rr.position
    FROM race_results rr
    WHERE rr.course_id = p_course_id
      AND rr.statut = 'finished'
      AND rr.position IS NOT NULL
      AND (
        rr.type_classement = 'Etape'::type_classement
        OR rr.type_classement::text LIKE 'Porteur%'
        OR rr.etape_numero IS NULL
      )
  ),
  scored AS (
    SELECT
      e.type_classement,
      e.etape_numero,
      e.coureur_id,
      co.phase_id,
      co.id AS course_id,
      r.manager_id
    FROM eligible e
    CROSS JOIN co
    LEFT JOIN rosters r
      ON r.coureur_id = e.coureur_id
     AND r.phase_id = co.phase_id
    WHERE r.manager_id IS NOT NULL
  )
  DELETE FROM points_ledger pl
  USING co
  WHERE pl.course_id = co.id
    AND NOT EXISTS (
      SELECT 1 FROM scored s
      WHERE s.course_id = pl.course_id
        AND s.type_classement = pl.type_classement
        AND COALESCE(s.etape_numero,-1) = COALESCE(pl.etape_numero,-1)
        AND s.coureur_id = pl.coureur_id
        AND s.manager_id = pl.manager_id
    );

  INSERT INTO audits (actor_manager_id, action, payload_json, created_at)
  VALUES (
    v_manager_id,
    'admin_compute_points_for_course',
    json_build_object(
      'course_id', p_course_id,
      'rows_upserted', v_rows_inserted,
      'missing_bareme', v_missing_bareme
    )::text,
    now()
  );

  RETURN json_build_object(
    'success', true,
    'course_id', p_course_id,
    'rows_upserted', v_rows_inserted,
    'missing_bareme', COALESCE(v_missing_bareme, '[]'::jsonb)
  );
END;
$function$;

-- ==========================================
-- Phase 1.5: Adapter fonction results_course_top
-- ==========================================

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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH co AS (
  SELECT c.id, c.categorie, c.phase_id, p.saison_id 
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

-- ==========================================
-- Phase 1.6: Adapter fonction results_course_rows
-- ==========================================

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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH co AS (
  SELECT c.id, c.categorie, c.phase_id, p.saison_id 
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

-- ==========================================
-- Phase 1.7: Adapter fonction results_course_table
-- ==========================================

CREATE OR REPLACE FUNCTION public.results_course_table(
  p_course_id text, 
  p_type_classement type_classement, 
  p_etape_numero integer DEFAULT NULL, 
  p_manager_id uuid DEFAULT NULL
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