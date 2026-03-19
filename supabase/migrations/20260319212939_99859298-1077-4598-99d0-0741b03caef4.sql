CREATE OR REPLACE VIEW bids_outcomes WITH (security_invoker = on) AS
SELECT b.id AS bid_id,
    b.manager_id,
    a.phase_id,
    b.league_id,
    b.coureur_id,
    c.nom AS coureur_nom,
    COALESCE(es.nom_affiche, c.equipe) AS coureur_equipe,
    b.montant AS my_bid,
        CASE
            WHEN b.statut = 'won'::bid_statut THEN 'won'::bid_outcome
            WHEN b.statut = 'lost'::bid_statut THEN 'lost'::bid_outcome
            WHEN b.statut = 'carried_over'::bid_statut THEN 'carried_over'::bid_outcome
            ELSE NULL::bid_outcome
        END AS outcome,
    a.round_number,
    winner.nom AS winning_manager,
    winning_roster.prix_signature AS winning_amount
   FROM bids b
     LEFT JOIN auctions a ON b.auction_id = a.id
     LEFT JOIN coureurs c ON b.coureur_id = c.id
     LEFT JOIN phases p ON p.id = a.phase_id
     LEFT JOIN coureurs_saisons cs ON cs.coureur_id = b.coureur_id AND cs.saison_id = p.saison_id
     LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cs.saison_id
     LEFT JOIN rosters winning_roster ON winning_roster.coureur_id = b.coureur_id AND winning_roster.phase_id = a.phase_id AND (winning_roster.league_id = b.league_id OR winning_roster.league_id IS NULL AND b.league_id IS NULL)
     LEFT JOIN managers winner ON winner.id = winning_roster.manager_id
  WHERE b.statut = ANY (ARRAY['pending'::bid_statut, 'won'::bid_statut, 'lost'::bid_statut, 'carried_over'::bid_statut]);