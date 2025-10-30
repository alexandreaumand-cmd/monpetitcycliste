-- Nettoyer les enchères "open" en doublon
-- Garde uniquement la plus récente par (phase_id, league_id, round_number)
DELETE FROM auctions
WHERE id IN (
  SELECT a1.id
  FROM auctions a1
  WHERE a1.statut = 'open'
    AND EXISTS (
      SELECT 1
      FROM auctions a2
      WHERE a2.phase_id = a1.phase_id
        AND a2.league_id = a1.league_id
        AND a2.round_number = a1.round_number
        AND a2.statut = 'open'
        AND a2.created_at > a1.created_at
    )
);