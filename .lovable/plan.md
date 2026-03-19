

## Plan : Corriger l'enchère gagnante affichée dans l'historique des enchères

### Problème identifié

La vue SQL `bids_outcomes` calcule le `winning_amount` en joignant la table `bids` pour retrouver le montant gagnant. Le problème : cette jointure filtre par `coureur_id + manager_id + statut='won' + league_id` mais **ne filtre PAS par `phase_id`**.

Conséquence : si un même manager a gagné le même coureur dans plusieurs phases de la même ligue, la jointure retourne plusieurs lignes et la base choisit un montant arbitraire (souvent celui d'une autre phase).

### Solution

La table `rosters` contient déjà le champ `prix_signature` qui correspond exactement au montant de l'enchère gagnante, et est déjà correctement filtrée par `phase_id` ET `league_id` dans la jointure existante.

**Migration SQL** : modifier la vue `bids_outcomes` pour :
1. Remplacer `winner_bid.montant AS winning_amount` par `winning_roster.prix_signature AS winning_amount`
2. Supprimer la jointure `LEFT JOIN bids winner_bid` devenue inutile

### Détails techniques

Fichier impacté : **migration SQL uniquement** (pas de code frontend à modifier, les composants `RoundHistoryTab`, `BidHistory`, etc. utilisent déjà le champ `winning_amount` retourné par la vue).

```sql
CREATE OR REPLACE VIEW bids_outcomes AS
SELECT 
  b.id AS bid_id,
  b.manager_id,
  a.phase_id,
  b.league_id,
  b.coureur_id,
  c.nom AS coureur_nom,
  COALESCE(es.nom_affiche, c.equipe) AS coureur_equipe,
  b.montant AS my_bid,
  CASE
    WHEN b.statut = 'won' THEN 'won'::bid_outcome
    WHEN b.statut = 'lost' THEN 'lost'::bid_outcome
    WHEN b.statut = 'carried_over' THEN 'carried_over'::bid_outcome
    ELSE NULL::bid_outcome
  END AS outcome,
  a.round_number,
  winner.nom AS winning_manager,
  winning_roster.prix_signature AS winning_amount  -- was: winner_bid.montant
FROM bids b
  LEFT JOIN auctions a ON b.auction_id = a.id
  LEFT JOIN coureurs c ON b.coureur_id = c.id
  LEFT JOIN phases p ON p.id = a.phase_id
  LEFT JOIN coureurs_saisons cs ON cs.coureur_id = b.coureur_id AND cs.saison_id = p.saison_id
  LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cs.saison_id
  LEFT JOIN rosters winning_roster ON winning_roster.coureur_id = b.coureur_id 
    AND winning_roster.phase_id = a.phase_id 
    AND (winning_roster.league_id = b.league_id OR ...)
  -- REMOVED: LEFT JOIN bids winner_bid (source du bug)
  LEFT JOIN managers winner ON winner.id = winning_roster.manager_id
WHERE b.statut = ANY (ARRAY['pending','won','lost','carried_over']::bid_statut[]);
```

### Risque
Faible — `prix_signature` est renseigné à l'insertion dans le roster au moment de la résolution des enchères, il correspond toujours au montant gagnant.

