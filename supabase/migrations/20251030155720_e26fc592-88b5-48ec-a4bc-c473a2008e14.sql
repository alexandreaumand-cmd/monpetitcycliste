-- Drop and recreate get_top_riders_optimized with correct result_statut values
-- This fixes the "invalid input value for enum result_statut: 'Officiel'" error

DROP FUNCTION IF EXISTS get_top_riders_optimized(UUID, UUID, UUID, INT);

CREATE OR REPLACE FUNCTION get_top_riders_optimized(
  p_saison_id UUID DEFAULT NULL,
  p_phase_id UUID DEFAULT NULL,
  p_league_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 5000
)
RETURNS TABLE (
  coureur_id TEXT,
  coureur_nom TEXT,
  coureur_equipe TEXT,
  total_points BIGINT,
  courses_count BIGINT,
  owner_manager_id UUID,
  owner_manager_nom TEXT,
  prix_initial NUMERIC
) AS $$
BEGIN
  IF p_phase_id IS NOT NULL THEN
    -- Query by phase
    RETURN QUERY
    SELECT
      c.id AS coureur_id,
      c.nom AS coureur_nom,
      c.equipe AS coureur_equipe,
      COALESCE(SUM(rr.points), 0)::BIGINT AS total_points,
      COUNT(DISTINCT rr.course_id)::BIGINT AS courses_count,
      NULL::UUID AS owner_manager_id,
      NULL::TEXT AS owner_manager_nom,
      c.prix_initial
    FROM coureurs c
    LEFT JOIN race_results rr ON rr.coureur_id = c.id
      AND rr.course_id IN (
        SELECT co.id
        FROM courses co
        WHERE co.phase_id = p_phase_id
      )
      AND (rr.statut = 'finished' OR rr.statut IS NULL)
    GROUP BY c.id, c.nom, c.equipe, c.prix_initial
    HAVING COALESCE(SUM(rr.points), 0) > 0
    ORDER BY total_points DESC
    LIMIT p_limit;
  ELSE
    -- Query by season (all phases in the season)
    RETURN QUERY
    SELECT
      c.id AS coureur_id,
      c.nom AS coureur_nom,
      c.equipe AS coureur_equipe,
      COALESCE(SUM(rr.points), 0)::BIGINT AS total_points,
      COUNT(DISTINCT rr.course_id)::BIGINT AS courses_count,
      NULL::UUID AS owner_manager_id,
      NULL::TEXT AS owner_manager_nom,
      c.prix_initial
    FROM coureurs c
    LEFT JOIN race_results rr ON rr.coureur_id = c.id
      AND rr.course_id IN (
        SELECT co.id
        FROM courses co
        JOIN phases ph ON ph.id = co.phase_id
        WHERE ph.saison_id = p_saison_id
      )
      AND (rr.statut = 'finished' OR rr.statut IS NULL)
    GROUP BY c.id, c.nom, c.equipe, c.prix_initial
    HAVING COALESCE(SUM(rr.points), 0) > 0
    ORDER BY total_points DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;