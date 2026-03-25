CREATE OR REPLACE FUNCTION public.get_top_riders_optimized(
  p_saison_id UUID DEFAULT NULL,
  p_phase_id UUID DEFAULT NULL,
  p_league_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 5000
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saison_id UUID;
  v_started_at_effective TIMESTAMPTZ;
BEGIN
  IF p_phase_id IS NOT NULL THEN
    SELECT saison_id INTO v_saison_id FROM phases WHERE id = p_phase_id;
  ELSE
    v_saison_id := p_saison_id;
  END IF;

  IF p_league_id IS NOT NULL THEN
    SELECT l.started_at_effective INTO v_started_at_effective
    FROM leagues l WHERE l.id = p_league_id;
  END IF;

  IF p_phase_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      c.id AS coureur_id,
      COALESCE(c.nom, c.id) AS coureur_nom,
      COALESCE(es.nom_affiche, 'N/A') AS coureur_equipe,
      COALESCE(SUM(pl.points), 0)::BIGINT AS total_points,
      COUNT(DISTINCT pl.course_id)::BIGINT AS courses_count,
      NULL::UUID AS owner_manager_id,
      NULL::TEXT AS owner_manager_nom,
      COALESCE(cs.prix_initial, c.prix_initial) AS prix_initial
    FROM coureurs c
    LEFT JOIN points_ledger pl ON pl.coureur_id = c.id AND pl.phase_id = p_phase_id
      AND (p_league_id IS NULL OR pl.course_id IN (SELECT get_league_course_ids(p_league_id)))
      AND (v_started_at_effective IS NULL OR pl.course_id IN (
        SELECT co.id FROM courses co WHERE co.date_debut >= v_started_at_effective::date
      ))
    LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = v_saison_id
    LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = v_saison_id
    WHERE c.nom IS NOT NULL
    GROUP BY c.id, c.nom, es.nom_affiche, cs.prix_initial, c.prix_initial
    HAVING COALESCE(SUM(pl.points), 0) > 0
    ORDER BY total_points DESC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT
      c.id AS coureur_id,
      COALESCE(c.nom, c.id) AS coureur_nom,
      COALESCE(es.nom_affiche, 'N/A') AS coureur_equipe,
      COALESCE(SUM(pl.points), 0)::BIGINT AS total_points,
      COUNT(DISTINCT pl.course_id)::BIGINT AS courses_count,
      NULL::UUID AS owner_manager_id,
      NULL::TEXT AS owner_manager_nom,
      COALESCE(cs.prix_initial, c.prix_initial) AS prix_initial
    FROM coureurs c
    LEFT JOIN points_ledger pl ON pl.coureur_id = c.id
      AND pl.phase_id IN (SELECT id FROM phases WHERE saison_id = v_saison_id)
      AND (p_league_id IS NULL OR pl.course_id IN (SELECT get_league_course_ids(p_league_id)))
      AND (v_started_at_effective IS NULL OR pl.course_id IN (
        SELECT co.id FROM courses co WHERE co.date_debut >= v_started_at_effective::date
      ))
    LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = v_saison_id
    LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = v_saison_id
    WHERE c.nom IS NOT NULL
    GROUP BY c.id, c.nom, es.nom_affiche, cs.prix_initial, c.prix_initial
    HAVING COALESCE(SUM(pl.points), 0) > 0
    ORDER BY total_points DESC
    LIMIT p_limit;
  END IF;
END;
$$;