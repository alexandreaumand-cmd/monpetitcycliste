-- Migration: Replace single points column with 4 distinct bonus categories

-- Step 1: Drop views that depend on the points column
DROP VIEW IF EXISTS public.v_manager_standings_by_phase;
DROP VIEW IF EXISTS public.v_manager_standings_total;

-- Step 2: Add the 4 new bonus columns to manager_bonus_points
ALTER TABLE public.manager_bonus_points
ADD COLUMN bonus_itt integer NOT NULL DEFAULT 0,
ADD COLUMN bonus_ttt integer NOT NULL DEFAULT 0,
ADD COLUMN bonus_first_win integer NOT NULL DEFAULT 0,
ADD COLUMN bonus_coureurs integer NOT NULL DEFAULT 0;

-- Step 3: Migrate existing data (move old 'points' to 'bonus_coureurs' by default)
UPDATE public.manager_bonus_points
SET bonus_coureurs = points
WHERE points IS NOT NULL AND points != 0;

-- Step 4: Drop the old points column
ALTER TABLE public.manager_bonus_points
DROP COLUMN points;

-- Step 5: Recreate v_manager_standings_by_phase with new bonus calculation
CREATE OR REPLACE VIEW public.v_manager_standings_by_phase AS
WITH race_pts AS (
  SELECT 
    pl.phase_id,
    pl.manager_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.course_id) AS courses_count
  FROM points_ledger pl
  GROUP BY pl.phase_id, pl.manager_id
),
bonus_pts AS (
  SELECT 
    mbp.phase_id,
    mbp.manager_id,
    SUM(COALESCE(mbp.bonus_itt, 0) + COALESCE(mbp.bonus_ttt, 0) + 
        COALESCE(mbp.bonus_first_win, 0) + COALESCE(mbp.bonus_coureurs, 0)) AS bonus_points
  FROM manager_bonus_points mbp
  GROUP BY mbp.phase_id, mbp.manager_id
)
SELECT
  m.id AS manager_id,
  m.nom AS manager_nom,
  rp.phase_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(bp.bonus_points, 0) AS total_points,
  COALESCE(rp.courses_count, 0) AS courses_count
FROM managers m
CROSS JOIN phases ph
LEFT JOIN race_pts rp ON rp.manager_id = m.id AND rp.phase_id = ph.id
LEFT JOIN bonus_pts bp ON bp.manager_id = m.id AND bp.phase_id = ph.id
WHERE rp.race_points IS NOT NULL OR bp.bonus_points IS NOT NULL;

-- Step 6: Recreate v_manager_standings_total with new bonus calculation
CREATE OR REPLACE VIEW public.v_manager_standings_total AS
WITH race_pts AS (
  SELECT 
    pl.manager_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.course_id) AS courses_count
  FROM points_ledger pl
  GROUP BY pl.manager_id
),
bonus_pts AS (
  SELECT 
    mbp.manager_id,
    SUM(COALESCE(mbp.bonus_itt, 0) + COALESCE(mbp.bonus_ttt, 0) + 
        COALESCE(mbp.bonus_first_win, 0) + COALESCE(mbp.bonus_coureurs, 0)) AS bonus_points
  FROM manager_bonus_points mbp
  GROUP BY mbp.manager_id
)
SELECT
  m.id AS manager_id,
  m.nom AS manager_nom,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(bp.bonus_points, 0) AS total_points,
  COALESCE(rp.courses_count, 0) AS courses_count
FROM managers m
LEFT JOIN race_pts rp ON rp.manager_id = m.id
LEFT JOIN bonus_pts bp ON bp.manager_id = m.id
WHERE rp.race_points IS NOT NULL OR bp.bonus_points IS NOT NULL;