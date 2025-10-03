-- =====================================================
-- PARTIE 1: Indexes pour performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_race_results_manager ON race_results(manager_id);
CREATE INDEX IF NOT EXISTS idx_race_results_phase ON race_results(course_id, type_classement);
CREATE INDEX IF NOT EXISTS idx_race_results_coureur ON race_results(coureur_id);
CREATE INDEX IF NOT EXISTS idx_race_results_course ON race_results(course_id);
CREATE INDEX IF NOT EXISTS idx_race_results_type_stage ON race_results(type_classement, etape_numero);

CREATE INDEX IF NOT EXISTS idx_points_ledger_manager ON points_ledger(manager_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_phase ON points_ledger(phase_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_coureur ON points_ledger(coureur_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_course ON points_ledger(course_id);

-- =====================================================
-- PARTIE 2: Vues pour classements managers
-- =====================================================

-- Vue: Classement total des managers
CREATE OR REPLACE VIEW v_manager_standings_total AS
SELECT 
  m.id AS manager_id, 
  m.nom AS manager_nom,
  COALESCE(SUM(pl.points), 0) AS total_points,
  COUNT(DISTINCT pl.course_id) AS courses_count
FROM managers m
LEFT JOIN points_ledger pl ON pl.manager_id = m.id
GROUP BY m.id, m.nom
ORDER BY total_points DESC, manager_nom ASC;

-- Vue: Classement par phase (paramétré via WHERE)
CREATE OR REPLACE VIEW v_manager_standings_by_phase AS
SELECT 
  m.id AS manager_id, 
  m.nom AS manager_nom,
  pl.phase_id,
  COALESCE(SUM(pl.points), 0) AS total_points,
  COUNT(DISTINCT pl.course_id) AS courses_count
FROM managers m
LEFT JOIN points_ledger pl ON pl.manager_id = m.id
GROUP BY m.id, m.nom, pl.phase_id
ORDER BY pl.phase_id, total_points DESC, manager_nom ASC;

-- Vue: Top coureurs global
CREATE OR REPLACE VIEW v_top_riders_global AS
SELECT 
  c.id AS coureur_id, 
  c.nom AS coureur_nom,
  c.equipe AS coureur_equipe,
  COALESCE(SUM(pl.points), 0) AS total_points,
  COUNT(DISTINCT pl.course_id) AS courses_count
FROM coureurs c
JOIN points_ledger pl ON pl.coureur_id = c.id
GROUP BY c.id, c.nom, c.equipe
ORDER BY total_points DESC, coureur_nom ASC;

-- Vue: Top coureurs par phase
CREATE OR REPLACE VIEW v_top_riders_by_phase AS
SELECT 
  c.id AS coureur_id, 
  c.nom AS coureur_nom,
  c.equipe AS coureur_equipe,
  pl.phase_id,
  COALESCE(SUM(pl.points), 0) AS total_points,
  COUNT(DISTINCT pl.course_id) AS courses_count
FROM coureurs c
JOIN points_ledger pl ON pl.coureur_id = c.id
GROUP BY c.id, c.nom, c.equipe, pl.phase_id
ORDER BY pl.phase_id, total_points DESC, coureur_nom ASC;

-- Vue: Détail manager (décomposition par course)
CREATE OR REPLACE VIEW v_manager_breakdown AS
SELECT
  pl.manager_id,
  m.nom AS manager_nom,
  co.id AS course_id,
  co.nom AS course_nom,
  co.date_debut,
  co.date_fin,
  pl.type_classement,
  COALESCE(pl.etape_numero, 0) AS etape_numero,
  cu.id AS coureur_id,
  cu.nom AS coureur_nom,
  pl.points
FROM points_ledger pl
JOIN managers m ON m.id = pl.manager_id
JOIN courses co ON co.id = pl.course_id
JOIN coureurs cu ON cu.id = pl.coureur_id
ORDER BY pl.manager_id, co.date_debut DESC, pl.type_classement, pl.etape_numero NULLS LAST, pl.points DESC;

-- Vue: Chronologie points récents
CREATE OR REPLACE VIEW v_recent_points AS
SELECT
  DATE_TRUNC('day', co.date_fin) AS jour,
  m.id AS manager_id,
  m.nom AS manager_nom,
  SUM(pl.points) AS points_jour
FROM points_ledger pl
JOIN courses co ON co.id = pl.course_id
JOIN managers m ON m.id = pl.manager_id
WHERE co.date_fin >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;

-- =====================================================
-- PARTIE 3: Vue de vérification pour save
-- =====================================================

CREATE OR REPLACE FUNCTION verify_course_save(p_course_id text)
RETURNS TABLE(
  result_count bigint,
  result_scored bigint,
  manager_attribs bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM race_results WHERE course_id = p_course_id),
    (SELECT COUNT(*) FROM race_results WHERE course_id = p_course_id AND points > 0),
    (SELECT COUNT(*) FROM points_ledger WHERE course_id = p_course_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;