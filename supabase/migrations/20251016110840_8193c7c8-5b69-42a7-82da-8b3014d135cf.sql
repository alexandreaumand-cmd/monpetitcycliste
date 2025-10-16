-- RPC functions for ROI calculations
-- ROI = Σ points / Σ prix d'achat on the same perimeter (season or phase)

-- Function: rider_roi_season
-- Returns ROI per rider for a given season
CREATE OR REPLACE FUNCTION public.rider_roi_season(p_saison_id uuid)
RETURNS TABLE(
  rider_id text,
  total_points bigint,
  total_purchase_price numeric,
  roi numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phase_ids uuid[];
BEGIN
  -- Get all phases for the season
  SELECT ARRAY_AGG(id) INTO v_phase_ids
  FROM phases
  WHERE saison_id = p_saison_id;

  RETURN QUERY
  WITH rider_points AS (
    SELECT 
      pl.coureur_id,
      SUM(pl.points) AS total_points
    FROM points_ledger pl
    WHERE pl.phase_id = ANY(v_phase_ids)
    GROUP BY pl.coureur_id
  ),
  rider_prices AS (
    SELECT 
      r.coureur_id,
      SUM(r.prix_signature) AS total_purchase_price
    FROM rosters r
    WHERE r.phase_id = ANY(v_phase_ids)
    GROUP BY r.coureur_id
  ),
  rider_bonus AS (
    SELECT
      bp.coureur_id,
      SUM(bp.points) AS bonus_points
    FROM bonus_points bp
    WHERE bp.phase_id = ANY(v_phase_ids)
      AND bp.coureur_id IS NOT NULL
    GROUP BY bp.coureur_id
  )
  SELECT
    COALESCE(p.coureur_id, pr.coureur_id, b.coureur_id) AS rider_id,
    COALESCE(p.total_points, 0) + COALESCE(b.bonus_points, 0) AS total_points,
    COALESCE(pr.total_purchase_price, 0) AS total_purchase_price,
    CASE 
      WHEN COALESCE(pr.total_purchase_price, 0) = 0 THEN 0
      ELSE (COALESCE(p.total_points, 0) + COALESCE(b.bonus_points, 0))::numeric / NULLIF(pr.total_purchase_price, 0)
    END AS roi
  FROM rider_points p
  FULL OUTER JOIN rider_prices pr USING (coureur_id)
  FULL OUTER JOIN rider_bonus b USING (coureur_id)
  WHERE COALESCE(p.total_points, 0) + COALESCE(b.bonus_points, 0) > 0
  ORDER BY total_points DESC NULLS LAST;
END;
$$;

-- Function: rider_roi_phase
-- Returns ROI per rider for a given phase
CREATE OR REPLACE FUNCTION public.rider_roi_phase(p_phase_id uuid)
RETURNS TABLE(
  rider_id text,
  total_points bigint,
  total_purchase_price numeric,
  roi numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH rider_points AS (
    SELECT 
      pl.coureur_id,
      SUM(pl.points) AS total_points
    FROM points_ledger pl
    WHERE pl.phase_id = p_phase_id
    GROUP BY pl.coureur_id
  ),
  rider_prices AS (
    SELECT 
      r.coureur_id,
      SUM(r.prix_signature) AS total_purchase_price
    FROM rosters r
    WHERE r.phase_id = p_phase_id
    GROUP BY r.coureur_id
  ),
  rider_bonus AS (
    SELECT
      bp.coureur_id,
      SUM(bp.points) AS bonus_points
    FROM bonus_points bp
    WHERE bp.phase_id = p_phase_id
      AND bp.coureur_id IS NOT NULL
    GROUP BY bp.coureur_id
  )
  SELECT
    COALESCE(p.coureur_id, pr.coureur_id, b.coureur_id) AS rider_id,
    COALESCE(p.total_points, 0) + COALESCE(b.bonus_points, 0) AS total_points,
    COALESCE(pr.total_purchase_price, 0) AS total_purchase_price,
    CASE 
      WHEN COALESCE(pr.total_purchase_price, 0) = 0 THEN 0
      ELSE (COALESCE(p.total_points, 0) + COALESCE(b.bonus_points, 0))::numeric / NULLIF(pr.total_purchase_price, 0)
    END AS roi
  FROM rider_points p
  FULL OUTER JOIN rider_prices pr USING (coureur_id)
  FULL OUTER JOIN rider_bonus b USING (coureur_id)
  WHERE COALESCE(p.total_points, 0) + COALESCE(b.bonus_points, 0) > 0
  ORDER BY total_points DESC NULLS LAST;
END;
$$;