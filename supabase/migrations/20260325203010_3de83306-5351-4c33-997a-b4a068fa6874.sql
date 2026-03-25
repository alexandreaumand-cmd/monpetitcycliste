
-- 1. Fix get_top_riders_optimized: use COALESCE(started_at_effective, created_at)
CREATE OR REPLACE FUNCTION public.get_top_riders_optimized(p_saison_id uuid DEFAULT NULL::uuid, p_phase_id uuid DEFAULT NULL::uuid, p_league_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 5000)
 RETURNS TABLE(coureur_id text, coureur_nom text, coureur_equipe text, total_points bigint, courses_count bigint, owner_manager_id uuid, owner_manager_nom text, prix_initial numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT COALESCE(l.started_at_effective, l.created_at) INTO v_started_at_effective
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
$function$;

-- 2. Fix v_manager_standings_by_phase_v2
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;
CREATE OR REPLACE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT r.manager_id, r.league_id, r.phase_id,
    SUM(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN leagues l ON l.id = r.league_id
  WHERE c.date_debut >= COALESCE(l.started_at_effective, l.created_at)::date
    AND pl.course_id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc)
  GROUP BY r.manager_id, r.league_id, r.phase_id
),
manager_bonus_pts AS (
  SELECT manager_id, league_id, phase_id,
    SUM(bonus_itt + bonus_ttt + bonus_first_win + bonus_coureurs + bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points
  GROUP BY manager_id, league_id, phase_id
),
rider_bonus_pts AS (
  SELECT COALESCE(manager_id, target_manager_id) AS manager_id, league_id, phase_id,
    SUM(points) AS rider_bonus
  FROM bonus_points
  GROUP BY COALESCE(manager_id, target_manager_id), league_id, phase_id
),
scoreurs AS (
  SELECT r.manager_id, r.league_id, r.phase_id,
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN race_results rr ON rr.coureur_id = pl.coureur_id AND rr.course_id = pl.course_id
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  JOIN leagues l ON l.id = r.league_id
  WHERE pl.points > 0
    AND (rr.position_decimal IS NULL OR rr.position_decimal = FLOOR(rr.position_decimal))
    AND c.date_debut >= COALESCE(l.started_at_effective, l.created_at)::date
    AND pl.course_id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc)
  GROUP BY r.manager_id, r.league_id, r.phase_id
),
victories AS (
  SELECT r.manager_id, r.league_id, r.phase_id,
    COUNT(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  JOIN leagues l ON l.id = r.league_id
  WHERE rr.position = 1 AND rr.statut = 'finished'
    AND rr.type_classement IN ('Etape', 'General')
    AND c.date_debut >= COALESCE(l.started_at_effective, l.created_at)::date
    AND c.id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc)
    AND NOT EXISTS (
      SELECT 1 FROM race_results rr2
      WHERE rr2.course_id = rr.course_id AND rr2.type_classement = rr.type_classement
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2.position = 1 AND rr2.statut = 'finished'
      GROUP BY rr2.course_id, rr2.type_classement, COALESCE(rr2.etape_numero, -1)
      HAVING COUNT(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, r.phase_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, sc.phase_id, v.phase_id) AS phase_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0)::numeric + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom,
  m.avatar_url
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.league_id = rp.league_id AND mbp.phase_id = rp.phase_id
FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id) AND rbp.phase_id = COALESCE(rp.phase_id, mbp.phase_id)
FULL OUTER JOIN scoreurs sc ON sc.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND sc.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id) AND sc.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id)
FULL OUTER JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id) AND v.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, sc.phase_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

-- 3. Fix v_manager_standings_by_season_v2
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;
CREATE OR REPLACE VIEW v_manager_standings_by_season_v2 AS
WITH race_pts AS (
  SELECT r.manager_id, r.league_id, p.saison_id,
    SUM(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN leagues l ON l.id = r.league_id
  WHERE c.date_debut >= COALESCE(l.started_at_effective, l.created_at)::date
    AND pl.course_id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc)
  GROUP BY r.manager_id, r.league_id, p.saison_id
),
manager_bonus_pts AS (
  SELECT mbp.manager_id, mbp.league_id, p.saison_id,
    SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN phases p ON p.id = mbp.phase_id
  GROUP BY mbp.manager_id, mbp.league_id, p.saison_id
),
rider_bonus_pts AS (
  SELECT COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id, bp.league_id, p.saison_id,
    SUM(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN phases p ON p.id = bp.phase_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, p.saison_id
),
scoreurs AS (
  SELECT r.manager_id, r.league_id, p.saison_id,
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN race_results rr ON rr.coureur_id = pl.coureur_id AND rr.course_id = pl.course_id
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  JOIN leagues l ON l.id = r.league_id
  WHERE pl.points > 0
    AND (rr.position_decimal IS NULL OR rr.position_decimal = FLOOR(rr.position_decimal))
    AND c.date_debut >= COALESCE(l.started_at_effective, l.created_at)::date
    AND pl.course_id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc)
  GROUP BY r.manager_id, r.league_id, p.saison_id
),
victories AS (
  SELECT r.manager_id, r.league_id, p.saison_id,
    COUNT(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  JOIN leagues l ON l.id = r.league_id
  WHERE rr.position = 1 AND rr.statut = 'finished'
    AND rr.type_classement IN ('Etape', 'General')
    AND c.date_debut >= COALESCE(l.started_at_effective, l.created_at)::date
    AND c.id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc)
    AND NOT EXISTS (
      SELECT 1 FROM race_results rr2
      WHERE rr2.course_id = rr.course_id AND rr2.type_classement = rr.type_classement
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2.position = 1 AND rr2.statut = 'finished'
      GROUP BY rr2.course_id, rr2.type_classement, COALESCE(rr2.etape_numero, -1)
      HAVING COUNT(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, p.saison_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, sc.saison_id, v.saison_id) AS saison_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0)::numeric + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom,
  m.avatar_url
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.league_id = rp.league_id AND mbp.saison_id = rp.saison_id
FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id) AND rbp.saison_id = COALESCE(rp.saison_id, mbp.saison_id)
FULL OUTER JOIN scoreurs sc ON sc.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND sc.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id) AND sc.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id)
FULL OUTER JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id) AND v.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, sc.saison_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

-- 4. Fix manager_team_by_id: use COALESCE(started_at_effective, created_at)
CREATE OR REPLACE FUNCTION public.manager_team_by_id(p_manager_id uuid, p_phase_id uuid DEFAULT NULL::uuid, p_league_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(coureur_id text, nom text, equipe text, prix_achat numeric, cote_initiale numeric, points_total bigint, ratio_points_par_prix numeric, winning_round integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH current_phase AS (
  SELECT 
    COALESCE(p_phase_id, (SELECT id FROM phases WHERE statut = 'active' ORDER BY date_debut DESC LIMIT 1)) AS phase_id,
    p.saison_id
  FROM phases p
  WHERE p.id = COALESCE(p_phase_id, (SELECT id FROM phases WHERE statut = 'active' ORDER BY date_debut DESC LIMIT 1))
),
league_info AS (
  SELECT COALESCE(started_at_effective, created_at)::date AS effective_start
  FROM leagues
  WHERE id = p_league_id
),
allowed_courses AS (
  SELECT course_id FROM get_league_course_ids(p_league_id)
  WHERE p_league_id IS NOT NULL
),
roster AS (
  SELECT r.coureur_id, r.prix_signature, a.round_number
  FROM rosters r
  CROSS JOIN current_phase cp
  LEFT JOIN annonces a ON a.coureur_id = r.coureur_id 
                       AND a.winning_manager_id = p_manager_id
                       AND a.auction_id IN (
                         SELECT au.id FROM auctions au 
                         WHERE au.phase_id = cp.phase_id 
                           AND (p_league_id IS NULL OR au.league_id = p_league_id)
                       )
  WHERE r.phase_id = cp.phase_id
    AND r.manager_id = p_manager_id
    AND (p_league_id IS NULL OR r.league_id = p_league_id)
),
points AS (
  SELECT pl.coureur_id, SUM(pl.points) AS points_total
  FROM points_ledger pl
  INNER JOIN roster r ON r.coureur_id = pl.coureur_id
  CROSS JOIN current_phase cp
  WHERE pl.phase_id = cp.phase_id
    AND (
      p_league_id IS NULL 
      OR pl.course_id IN (SELECT ac.course_id FROM allowed_courses ac)
    )
    AND (
      p_league_id IS NULL
      OR pl.course_id IN (
        SELECT c.id FROM courses c, league_info li
        WHERE c.date_debut >= li.effective_start
      )
    )
  GROUP BY pl.coureur_id
),
rider_bonus AS (
  SELECT bp.coureur_id, SUM(bp.points) AS bonus_points
  FROM bonus_points bp
  CROSS JOIN current_phase cp
  WHERE bp.phase_id = cp.phase_id
    AND (bp.manager_id = p_manager_id OR bp.target_manager_id = p_manager_id)
    AND bp.coureur_id IS NOT NULL
    AND (p_league_id IS NULL OR bp.league_id = p_league_id)
  GROUP BY bp.coureur_id
)
SELECT
  r.coureur_id,
  c.nom,
  COALESCE(es.nom_affiche, 'N/A') AS equipe,
  r.prix_signature AS prix_achat,
  COALESCE(cs.prix_initial, 10) AS cote_initiale,
  COALESCE(p.points_total, 0) + COALESCE(rb.bonus_points, 0) AS points_total,
  ROUND((COALESCE(p.points_total, 0) + COALESCE(rb.bonus_points, 0))::numeric / NULLIF(r.prix_signature, 0), 2) AS ratio_points_par_prix,
  r.round_number AS winning_round
FROM roster r
JOIN coureurs c ON c.id = r.coureur_id
CROSS JOIN current_phase cp
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = cp.saison_id
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cp.saison_id
LEFT JOIN points p ON p.coureur_id = r.coureur_id
LEFT JOIN rider_bonus rb ON rb.coureur_id = r.coureur_id
ORDER BY points_total DESC NULLS LAST;
$function$;

-- 5. Fix get_previous_standings
CREATE OR REPLACE FUNCTION public.get_previous_standings(p_saison_id uuid DEFAULT NULL::uuid, p_reference_phase_id uuid DEFAULT NULL::uuid, p_league_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(manager_id uuid, manager_nom text, total_points numeric, rank integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_completed_phase_ids uuid[];
  v_league_course_ids text[];
  v_effective_start date;
BEGIN
  IF p_league_id IS NOT NULL THEN
    SELECT ARRAY_AGG(glc.course_id) INTO v_league_course_ids
    FROM public.get_league_course_ids(p_league_id) glc;

    SELECT COALESCE(l.started_at_effective, l.created_at)::date INTO v_effective_start
    FROM leagues l WHERE l.id = p_league_id;
  END IF;

  IF p_reference_phase_id IS NOT NULL THEN
    SELECT ARRAY_AGG(p.id) INTO v_completed_phase_ids
    FROM phases p
    WHERE (p_saison_id IS NULL OR p.saison_id = p_saison_id)
      AND p.id != p_reference_phase_id
      AND p.statut = 'completed'
      AND p.date_debut < (SELECT p2.date_debut FROM phases p2 WHERE p2.id = p_reference_phase_id);
  ELSE
    SELECT ARRAY_AGG(p.id) INTO v_completed_phase_ids
    FROM phases p
    WHERE (p_saison_id IS NULL OR p.saison_id = p_saison_id)
      AND p.statut = 'completed';
  END IF;

  IF v_completed_phase_ids IS NULL OR array_length(v_completed_phase_ids, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH race_pts AS (
    SELECT 
      r.manager_id,
      SUM(pl.points) AS race_points
    FROM points_ledger pl
    JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
    JOIN courses c ON c.id = pl.course_id
    WHERE pl.phase_id = ANY(v_completed_phase_ids)
      AND (p_league_id IS NULL OR r.league_id = p_league_id)
      AND (v_league_course_ids IS NULL OR pl.course_id = ANY(v_league_course_ids))
      AND (v_effective_start IS NULL OR c.date_debut >= v_effective_start)
    GROUP BY r.manager_id
  ),
  manager_bonus_pts AS (
    SELECT 
      mbp.manager_id,
      SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
    FROM manager_bonus_points mbp
    WHERE mbp.phase_id = ANY(v_completed_phase_ids)
      AND (p_league_id IS NULL OR mbp.league_id = p_league_id)
    GROUP BY mbp.manager_id
  ),
  rider_bonus_pts AS (
    SELECT 
      COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
      SUM(bp.points) AS rider_bonus
    FROM bonus_points bp
    WHERE bp.phase_id = ANY(v_completed_phase_ids)
      AND (p_league_id IS NULL OR bp.league_id = p_league_id)
    GROUP BY COALESCE(bp.manager_id, bp.target_manager_id)
  ),
  totals AS (
    SELECT 
      COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AS manager_id,
      COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points
    FROM race_pts rp
    FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id
    FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id)
  )
  SELECT 
    t.manager_id,
    m.nom AS manager_nom,
    t.total_points,
    RANK() OVER (ORDER BY t.total_points DESC)::integer AS rank
  FROM totals t
  LEFT JOIN managers m ON m.id = t.manager_id
  ORDER BY rank;
END;
$function$;
