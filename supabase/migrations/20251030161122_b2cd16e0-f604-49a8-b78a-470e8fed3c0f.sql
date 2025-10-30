-- Fix get_top_riders_optimized to use points_ledger instead of race_results
-- race_results.points are always 0, real points are in points_ledger

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
    -- Query by phase using points_ledger
    RETURN QUERY
    SELECT
      c.id AS coureur_id,
      c.nom AS coureur_nom,
      c.equipe AS coureur_equipe,
      COALESCE(SUM(pl.points), 0)::BIGINT AS total_points,
      COUNT(DISTINCT pl.course_id)::BIGINT AS courses_count,
      NULL::UUID AS owner_manager_id,
      NULL::TEXT AS owner_manager_nom,
      c.prix_initial
    FROM coureurs c
    LEFT JOIN points_ledger pl ON pl.coureur_id = c.id
      AND pl.phase_id = p_phase_id
    GROUP BY c.id, c.nom, c.equipe, c.prix_initial
    HAVING COALESCE(SUM(pl.points), 0) > 0
    ORDER BY total_points DESC
    LIMIT p_limit;
  ELSE
    -- Query by season (all phases in the season) using points_ledger
    RETURN QUERY
    SELECT
      c.id AS coureur_id,
      c.nom AS coureur_nom,
      c.equipe AS coureur_equipe,
      COALESCE(SUM(pl.points), 0)::BIGINT AS total_points,
      COUNT(DISTINCT pl.course_id)::BIGINT AS courses_count,
      NULL::UUID AS owner_manager_id,
      NULL::TEXT AS owner_manager_nom,
      c.prix_initial
    FROM coureurs c
    LEFT JOIN points_ledger pl ON pl.coureur_id = c.id
      AND pl.phase_id IN (
        SELECT id FROM phases WHERE saison_id = p_saison_id
      )
    GROUP BY c.id, c.nom, c.equipe, c.prix_initial
    HAVING COALESCE(SUM(pl.points), 0) > 0
    ORDER BY total_points DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public';