-- Ajouter league_id à bonus_points
ALTER TABLE bonus_points ADD COLUMN league_id UUID;

-- Peupler avec la legacy league pour toutes les données existantes
UPDATE bonus_points 
SET league_id = 'f7921741-29f4-4296-9aca-a03c1f3615b0'
WHERE league_id IS NULL;

-- Rendre la colonne NOT NULL
ALTER TABLE bonus_points ALTER COLUMN league_id SET NOT NULL;

-- Créer un trigger pour auto-remplir league_id
CREATE OR REPLACE FUNCTION bonus_points_set_league_from_roster()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.league_id IS NULL THEN
    SELECT r.league_id INTO NEW.league_id
    FROM rosters r
    WHERE r.manager_id = COALESCE(NEW.manager_id, NEW.target_manager_id)
      AND r.phase_id = NEW.phase_id
    LIMIT 1;
    
    -- Fallback to legacy league if no roster found
    IF NEW.league_id IS NULL THEN
      NEW.league_id := 'f7921741-29f4-4296-9aca-a03c1f3615b0';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER set_bonus_points_league
  BEFORE INSERT ON bonus_points
  FOR EACH ROW
  EXECUTE FUNCTION bonus_points_set_league_from_roster();

-- Recréer v_manager_standings_by_phase_v2 avec bp.league_id direct
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;

CREATE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT 
    pl.league_id,
    pl.phase_id,
    pl.manager_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.league_id, pl.phase_id, pl.manager_id
),
bonus_pts AS (
  SELECT
    bp.league_id,
    bp.phase_id,
    COALESCE(bp.target_manager_id, bp.manager_id) AS manager_id,
    SUM(bp.points) AS bonus_points
  FROM bonus_points bp
  GROUP BY bp.league_id, bp.phase_id, COALESCE(bp.target_manager_id, bp.manager_id)
),
scorers AS (
  SELECT
    pl.league_id,
    pl.phase_id,
    pl.manager_id,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count
  FROM points_ledger pl
  WHERE pl.points > 0
    AND pl.manager_id IS NOT NULL
  GROUP BY pl.league_id, pl.phase_id, pl.manager_id
),
victories AS (
  SELECT
    pl.league_id,
    pl.phase_id,
    pl.manager_id,
    COUNT(*) AS victories_count
  FROM points_ledger pl
  JOIN race_results rr
    ON rr.course_id = pl.course_id
   AND rr.coureur_id = pl.coureur_id
   AND rr.type_classement = pl.type_classement
   AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  WHERE rr.position = 1
    AND pl.manager_id IS NOT NULL
    AND rr.type_classement::text NOT LIKE 'Porteur%'
  GROUP BY pl.league_id, pl.phase_id, pl.manager_id
)
SELECT
  rp.league_id,
  rp.phase_id,
  rp.manager_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(bp.bonus_points, 0) AS total_points,
  COALESCE(sc.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM race_pts rp
LEFT JOIN bonus_pts bp USING (league_id, phase_id, manager_id)
LEFT JOIN scorers sc USING (league_id, phase_id, manager_id)
LEFT JOIN victories v USING (league_id, phase_id, manager_id);

-- Recréer v_manager_standings_by_season_v2 avec bp.league_id direct
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;

CREATE VIEW v_manager_standings_by_season_v2 AS
WITH phase_seasons AS (
  SELECT id AS phase_id, saison_id FROM phases
),
race_pts AS (
  SELECT
    pl.league_id,
    ps.saison_id,
    pl.manager_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN phase_seasons ps ON ps.phase_id = pl.phase_id
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.league_id, ps.saison_id, pl.manager_id
),
bonus_pts AS (
  SELECT
    bp.league_id,
    ps.saison_id,
    COALESCE(bp.target_manager_id, bp.manager_id) AS manager_id,
    SUM(bp.points) AS bonus_points
  FROM bonus_points bp
  JOIN phase_seasons ps ON ps.phase_id = bp.phase_id
  GROUP BY bp.league_id, ps.saison_id, COALESCE(bp.target_manager_id, bp.manager_id)
),
scorers AS (
  SELECT
    pl.league_id,
    ps.saison_id,
    pl.manager_id,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count
  FROM points_ledger pl
  JOIN phase_seasons ps ON ps.phase_id = pl.phase_id
  WHERE pl.points > 0
    AND pl.manager_id IS NOT NULL
  GROUP BY pl.league_id, ps.saison_id, pl.manager_id
),
victories AS (
  SELECT
    pl.league_id,
    ps.saison_id,
    pl.manager_id,
    COUNT(*) AS victories_count
  FROM points_ledger pl
  JOIN phase_seasons ps ON ps.phase_id = pl.phase_id
  JOIN race_results rr
    ON rr.course_id = pl.course_id
   AND rr.coureur_id = pl.coureur_id
   AND rr.type_classement = pl.type_classement
   AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  WHERE rr.position = 1
    AND pl.manager_id IS NOT NULL
    AND rr.type_classement::text NOT LIKE 'Porteur%'
  GROUP BY pl.league_id, ps.saison_id, pl.manager_id
)
SELECT
  rp.league_id,
  rp.saison_id,
  rp.manager_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(bp.bonus_points, 0) AS total_points,
  COALESCE(sc.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM race_pts rp
LEFT JOIN bonus_pts bp USING (league_id, saison_id, manager_id)
LEFT JOIN scorers sc USING (league_id, saison_id, manager_id)
LEFT JOIN victories v USING (league_id, saison_id, manager_id);