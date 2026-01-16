DROP VIEW IF EXISTS public.bids_outcomes;

CREATE VIEW public.bids_outcomes AS
SELECT 
    b.id AS bid_id,
    b.manager_id,
    a.phase_id,
    b.league_id,
    b.coureur_id,
    c.nom AS coureur_nom,
    -- Utiliser equipes_saisons via coureurs_saisons pour le nom d'équipe
    COALESCE(es.nom_affiche, c.equipe) AS coureur_equipe,
    b.montant AS my_bid,
    -- Utiliser directement le statut du bid
    CASE 
      WHEN b.statut = 'won' THEN 'won'::bid_outcome
      WHEN b.statut = 'lost' THEN 'lost'::bid_outcome
      WHEN b.statut = 'carried_over' THEN 'carried_over'::bid_outcome
      ELSE NULL
    END AS outcome,
    a.round_number,
    winner.nom AS winning_manager,
    winner_bid.montant AS winning_amount
FROM bids b
LEFT JOIN auctions a ON b.auction_id = a.id
LEFT JOIN coureurs c ON b.coureur_id = c.id
-- Joindre phases pour récupérer saison_id
LEFT JOIN phases p ON p.id = a.phase_id
-- Joindre coureurs_saisons pour cette saison
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = b.coureur_id AND cs.saison_id = p.saison_id
-- Joindre equipes_saisons pour le nom d'équipe affiché
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cs.saison_id
LEFT JOIN rosters winning_roster ON (
    winning_roster.coureur_id = b.coureur_id 
    AND winning_roster.phase_id = a.phase_id 
    AND (winning_roster.league_id = b.league_id OR (winning_roster.league_id IS NULL AND b.league_id IS NULL))
)
LEFT JOIN bids winner_bid ON (
    winner_bid.coureur_id = winning_roster.coureur_id 
    AND winner_bid.manager_id = winning_roster.manager_id 
    AND winner_bid.statut = 'won'
    AND (winner_bid.league_id = b.league_id OR (winner_bid.league_id IS NULL AND b.league_id IS NULL))
)
LEFT JOIN managers winner ON winner.id = winning_roster.manager_id
WHERE b.statut IN ('pending', 'won', 'lost', 'carried_over');

GRANT SELECT ON public.bids_outcomes TO anon;
GRANT SELECT ON public.bids_outcomes TO authenticated;