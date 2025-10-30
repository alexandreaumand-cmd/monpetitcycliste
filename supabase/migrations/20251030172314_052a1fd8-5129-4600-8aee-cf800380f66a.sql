-- ==========================================
-- PHASE 6: Nettoyage systémique - Éliminer tous les fallbacks vers coureurs.equipe
-- ==========================================

-- 1. DROP et recréer v_top_riders_global
DROP VIEW IF EXISTS v_top_riders_global CASCADE;

CREATE OR REPLACE VIEW v_top_riders_global AS
SELECT 
  pl.coureur_id,
  c.nom AS coureur_nom,
  es.nom_affiche AS coureur_equipe,
  SUM(pl.points) AS total_points,
  COUNT(DISTINCT pl.course_id) AS courses_count
FROM points_ledger pl
LEFT JOIN coureurs c ON c.id = pl.coureur_id
LEFT JOIN courses co ON co.id = pl.course_id
LEFT JOIN phases ph ON ph.id = co.phase_id
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = pl.coureur_id AND cs.saison_id = ph.saison_id
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = ph.saison_id
GROUP BY pl.coureur_id, c.nom, es.nom_affiche
ORDER BY total_points DESC;

-- 2. DROP et recréer v_top_riders_by_phase
DROP VIEW IF EXISTS v_top_riders_by_phase CASCADE;

CREATE OR REPLACE VIEW v_top_riders_by_phase AS
SELECT 
  co.phase_id,
  pl.coureur_id,
  c.nom AS coureur_nom,
  es.nom_affiche AS coureur_equipe,
  SUM(pl.points) AS total_points,
  COUNT(DISTINCT pl.course_id) AS courses_count
FROM points_ledger pl
LEFT JOIN coureurs c ON c.id = pl.coureur_id
LEFT JOIN courses co ON co.id = pl.course_id
LEFT JOIN phases ph ON ph.id = co.phase_id
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = pl.coureur_id AND cs.saison_id = ph.saison_id
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = ph.saison_id
GROUP BY co.phase_id, pl.coureur_id, c.nom, es.nom_affiche
ORDER BY co.phase_id, total_points DESC;

-- 3. DROP puis recréer results_course_top (avec guillemets pour position)
DROP FUNCTION IF EXISTS results_course_top(TEXT, type_classement, INT, INT);

CREATE OR REPLACE FUNCTION results_course_top(
  p_course_id TEXT,
  p_type_classement type_classement,
  p_etape_numero INT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(
  coureur_id TEXT,
  coureur_nom TEXT,
  coureur_equipe TEXT,
  "position" INT,
  points INT,
  manager_id UUID,
  manager_nom TEXT,
  has_official_points BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rr.coureur_id,
    cr.nom AS coureur_nom,
    es.nom_affiche AS coureur_equipe,
    rr."position",
    rr.points,
    rr.manager_id,
    m.nom AS manager_nom,
    (rr.points IS NOT NULL) AS has_official_points
  FROM race_results rr
  LEFT JOIN coureurs cr ON cr.id = rr.coureur_id
  LEFT JOIN courses co ON co.id = rr.course_id
  LEFT JOIN phases ph ON ph.id = co.phase_id
  LEFT JOIN coureurs_saisons cs ON cs.coureur_id = rr.coureur_id AND cs.saison_id = ph.saison_id
  LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = ph.saison_id
  LEFT JOIN managers m ON m.id = rr.manager_id
  WHERE rr.course_id = p_course_id
    AND rr.type_classement = p_type_classement
    AND (p_etape_numero IS NULL OR rr.etape_numero = p_etape_numero)
    AND rr.statut = 'official'
  ORDER BY rr."position" ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. DROP puis recréer results_course_rows (avec guillemets pour position)
DROP FUNCTION IF EXISTS results_course_rows(TEXT, type_classement, INT);

CREATE OR REPLACE FUNCTION results_course_rows(
  p_course_id TEXT,
  p_type_classement type_classement,
  p_etape_numero INT DEFAULT NULL
)
RETURNS TABLE(
  coureur_id TEXT,
  coureur_nom TEXT,
  coureur_equipe TEXT,
  "position" INT,
  points INT,
  manager_id UUID,
  manager_nom TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rr.coureur_id,
    cr.nom AS coureur_nom,
    es.nom_affiche AS coureur_equipe,
    rr."position",
    rr.points,
    rr.manager_id,
    m.nom AS manager_nom
  FROM race_results rr
  LEFT JOIN coureurs cr ON cr.id = rr.coureur_id
  LEFT JOIN courses co ON co.id = rr.course_id
  LEFT JOIN phases ph ON ph.id = co.phase_id
  LEFT JOIN coureurs_saisons cs ON cs.coureur_id = rr.coureur_id AND cs.saison_id = ph.saison_id
  LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = ph.saison_id
  LEFT JOIN managers m ON m.id = rr.manager_id
  WHERE rr.course_id = p_course_id
    AND rr.type_classement = p_type_classement
    AND (p_etape_numero IS NULL OR rr.etape_numero = p_etape_numero)
  ORDER BY rr."position" ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. DROP et recréer coureurs_disponibilite
DROP VIEW IF EXISTS coureurs_disponibilite CASCADE;

CREATE OR REPLACE VIEW coureurs_disponibilite AS
SELECT
  c.id,
  c.nom,
  c.uci_id,
  es.nom_affiche AS equipe,
  cs.prix_initial,
  p.saison_id,
  p.id AS phase_id,
  p.statut AS phase_statut,
  CASE 
    WHEN r.coureur_id IS NOT NULL THEN true
    ELSE false
  END AS is_taken,
  m.nom AS taken_by_manager_nom
FROM coureurs c
CROSS JOIN phases p
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = p.saison_id
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = p.saison_id
LEFT JOIN rosters r ON r.coureur_id = c.id AND r.phase_id = p.id
LEFT JOIN managers m ON m.id = r.manager_id;