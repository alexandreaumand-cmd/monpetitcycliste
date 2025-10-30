-- Fix get_top_riders_optimized to use equipes_saisons
-- Instead of c.equipe (deprecated), use coureurs_saisons + equipes_saisons

DROP FUNCTION IF EXISTS get_top_riders_optimized(UUID, UUID, UUID, INT);

CREATE OR REPLACE FUNCTION get_top_riders_optimized(
  p_saison_id UUID DEFAULT NULL,
  p_phase_id UUID DEFAULT NULL,
  p_league_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 5000
)
RETURNS TABLE(
  coureur_id TEXT,
  coureur_nom TEXT,
  coureur_equipe TEXT,
  total_points BIGINT,
  courses_count BIGINT,
  owner_manager_id UUID,
  owner_manager_nom TEXT,
  prix_initial NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_saison_id UUID;
BEGIN
  -- Determine saison_id
  IF p_phase_id IS NOT NULL THEN
    SELECT saison_id INTO v_saison_id FROM phases WHERE id = p_phase_id;
  ELSE
    v_saison_id := p_saison_id;
  END IF;

  IF p_phase_id IS NOT NULL THEN
    -- Query by phase using points_ledger
    RETURN QUERY
    SELECT
      c.id AS coureur_id,
      c.nom AS coureur_nom,
      COALESCE(es.nom_affiche, 'N/A') AS coureur_equipe,
      COALESCE(SUM(pl.points), 0)::BIGINT AS total_points,
      COUNT(DISTINCT pl.course_id)::BIGINT AS courses_count,
      NULL::UUID AS owner_manager_id,
      NULL::TEXT AS owner_manager_nom,
      COALESCE(cs.prix_initial, c.prix_initial) AS prix_initial
    FROM coureurs c
    LEFT JOIN points_ledger pl ON pl.coureur_id = c.id AND pl.phase_id = p_phase_id
    LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = v_saison_id
    LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = v_saison_id
    GROUP BY c.id, c.nom, es.nom_affiche, cs.prix_initial, c.prix_initial
    HAVING COALESCE(SUM(pl.points), 0) > 0
    ORDER BY total_points DESC
    LIMIT p_limit;
  ELSE
    -- Query by season (all phases in the season) using points_ledger
    RETURN QUERY
    SELECT
      c.id AS coureur_id,
      c.nom AS coureur_nom,
      COALESCE(es.nom_affiche, 'N/A') AS coureur_equipe,
      COALESCE(SUM(pl.points), 0)::BIGINT AS total_points,
      COUNT(DISTINCT pl.course_id)::BIGINT AS courses_count,
      NULL::UUID AS owner_manager_id,
      NULL::TEXT AS owner_manager_nom,
      COALESCE(cs.prix_initial, c.prix_initial) AS prix_initial
    FROM coureurs c
    LEFT JOIN points_ledger pl ON pl.coureur_id = c.id
      AND pl.phase_id IN (SELECT id FROM phases WHERE saison_id = v_saison_id)
    LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = v_saison_id
    LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = v_saison_id
    GROUP BY c.id, c.nom, es.nom_affiche, cs.prix_initial, c.prix_initial
    HAVING COALESCE(SUM(pl.points), 0) > 0
    ORDER BY total_points DESC
    LIMIT p_limit;
  END IF;
END;
$$;