-- Supprimer et recréer la vue bids_outcomes avec league_id
DROP VIEW IF EXISTS bids_outcomes;

CREATE VIEW bids_outcomes AS
SELECT 
  b.id as bid_id,
  b.manager_id,
  a.phase_id,
  b.league_id,
  b.coureur_id,
  c.nom as coureur_nom,
  c.equipe as coureur_equipe,
  b.montant as my_bid,
  CASE
    WHEN r.coureur_id IS NOT NULL THEN 'won'::bid_outcome
    WHEN EXISTS (
      SELECT 1 FROM rosters r2
      WHERE r2.coureur_id = b.coureur_id
        AND r2.phase_id = a.phase_id
        AND (r2.league_id = b.league_id OR (r2.league_id IS NULL AND b.league_id IS NULL))
    ) THEN 'lost'::bid_outcome
    ELSE 'carried_over'::bid_outcome
  END as outcome,
  a.round_number,
  winner.nom as winning_manager,
  winner_bid.montant as winning_amount
FROM bids b
LEFT JOIN auctions a ON b.auction_id = a.id
LEFT JOIN coureurs c ON b.coureur_id = c.id
LEFT JOIN rosters r ON r.coureur_id = b.coureur_id 
  AND r.manager_id = b.manager_id 
  AND r.phase_id = a.phase_id
  AND (r.league_id = b.league_id OR (r.league_id IS NULL AND b.league_id IS NULL))
LEFT JOIN rosters winning_roster ON winning_roster.coureur_id = b.coureur_id
  AND winning_roster.phase_id = a.phase_id
  AND (winning_roster.league_id = b.league_id OR (winning_roster.league_id IS NULL AND b.league_id IS NULL))
LEFT JOIN bids winner_bid ON winner_bid.coureur_id = winning_roster.coureur_id
  AND winner_bid.manager_id = winning_roster.manager_id
  AND winner_bid.auction_id = b.auction_id
  AND (winner_bid.league_id = b.league_id OR (winner_bid.league_id IS NULL AND b.league_id IS NULL))
LEFT JOIN managers winner ON winner.id = winning_roster.manager_id
WHERE b.statut IN ('pending', 'won', 'lost', 'carried_over');