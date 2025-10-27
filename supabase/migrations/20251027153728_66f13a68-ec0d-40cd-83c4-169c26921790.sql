-- Drop and recreate managers_rosters_status view to include league_id
DROP VIEW IF EXISTS managers_rosters_status;

CREATE VIEW managers_rosters_status AS
WITH round_open AS (
  SELECT 
    auctions.id AS auction_id,
    auctions.round_number,
    auctions.phase_id,
    auctions.league_id
  FROM auctions
  WHERE auctions.statut = 'open'::auction_statut
), base AS (
  SELECT 
    m.id AS manager_id,
    m.nom AS manager_nom,
    p.id AS phase_id,
    r.league_id,
    p.max_coureurs,
    p.budget AS budget_initial,
    COALESCE((
      SELECT SUM(r2.prix_signature)
      FROM rosters r2
      WHERE r2.phase_id = p.id 
        AND r2.manager_id = m.id
        AND r2.league_id = r.league_id
    ), 0) AS budget_depense,
    (
      SELECT COUNT(*)
      FROM rosters r2
      WHERE r2.phase_id = p.id 
        AND r2.manager_id = m.id
        AND r2.league_id = r.league_id
    ) AS roster_count
  FROM managers m
  CROSS JOIN phases p
  LEFT JOIN LATERAL (
    SELECT DISTINCT league_id
    FROM rosters
    WHERE manager_id = m.id AND phase_id = p.id
  ) r ON true
  WHERE r.league_id IS NOT NULL
), pending AS (
  SELECT 
    b.manager_id,
    ro.phase_id,
    ro.league_id,
    COUNT(*) AS pending_count,
    COALESCE(SUM(b.montant), 0) AS pending_sum
  FROM bids b
  JOIN round_open ro ON ro.auction_id = b.auction_id
  WHERE b.statut = 'pending'::bid_statut
  GROUP BY b.manager_id, ro.phase_id, ro.league_id
)
SELECT 
  b.manager_id,
  b.manager_nom,
  b.phase_id,
  b.league_id,
  b.max_coureurs,
  b.roster_count,
  GREATEST(0, b.max_coureurs - b.roster_count) AS slots_restants,
  b.budget_initial - b.budget_depense AS budget_restant,
  b.budget_depense,
  COALESCE(p.pending_count, 0) AS pending_count,
  COALESCE(p.pending_sum, 0) AS pending_sum
FROM base b
LEFT JOIN pending p ON p.manager_id = b.manager_id 
  AND p.phase_id = b.phase_id
  AND p.league_id = b.league_id;