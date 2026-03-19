

## Plan : Corriger l'affichage des enchères perdues lors d'égalités

### Problème

Quand 2 managers sont à égalité sur un coureur, personne ne gagne → pas d'entrée dans `rosters`. La vue `bids_outcomes` joint sur `rosters` pour trouver `winning_amount` et `winning_manager`, donc les deux retournent `NULL`. L'UI affiche alors "Enchère gagnante : 0" et "Contre : (vide)" pour les managers ayant perdu ce coureur.

Exemple concret (LIVE) : Laurenz REX — Fab et Bubu à 51, Matt B à 21 → Matt B voit "Perdu" avec enchère gagnante à 0.

### Solution

**1. Migration SQL** — Modifier la vue `bids_outcomes` pour ajouter un fallback quand il n'y a pas de gagnant (égalité) :

- Ajouter une sous-requête latérale qui récupère le montant max et le manager correspondant parmi les bids `carried_over` du même coureur dans la même enchère
- Utiliser `COALESCE` :
  - `winning_amount` = `rosters.prix_signature` (gagnant classique) OU `max bid carried_over` (égalité)  
  - `winning_manager` = nom du gagnant OU nom du/des managers à égalité

```sql
-- Fallback: highest carried_over bid on the same rider in the same auction
LEFT JOIN LATERAL (
  SELECT MAX(b2.montant) AS top_bid
  FROM bids b2
  WHERE b2.auction_id = b.auction_id
    AND b2.coureur_id = b.coureur_id
    AND b2.statut = 'carried_over'
) tie_info ON winning_roster.id IS NULL

-- Then use:
COALESCE(winning_roster.prix_signature, tie_info.top_bid) AS winning_amount
```

Pour `winning_manager`, quand c'est une égalité (pas de roster), afficher le nom des managers à égalité n'est pas trivial en SQL. On peut soit :
- Laisser NULL côté SQL et gérer côté UI → plus simple
- Ou ajouter une sous-requête `STRING_AGG`

**2. Modification UI** (`RoundHistoryTab.tsx`) — Pour les enchères perdues, quand `winning_manager` est null :
- Afficher "Égalité" au lieu du nom du manager
- Afficher le montant de l'égalité au lieu de 0

### Détails techniques

Migration SQL : recréer la vue `bids_outcomes` avec le fallback latéral.

Fichiers UI impactés :
- `src/components/auction/v2/RoundHistoryTab.tsx` — section "Perdues"  
- `src/components/auction/BidHistory.tsx` — même logique si elle affiche `winning_manager`

