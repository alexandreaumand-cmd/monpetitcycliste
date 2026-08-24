# Récap par tour : tous les coureurs, toutes les enchères

Une fois les enchères d'une phase terminées, ajouter un onglet dédié qui rejoue chaque tour coureur par coureur, du plus cher au moins cher, avec la liste complète des enchères de tous les managers (gagnée et perdues).

## Ce que voit l'utilisateur

Nouvel onglet **« Récap par tour »** dans l'écran d'historique des enchères, à côté de « Récapitulatif », « Base de données », R1/R2/R3… et « Mon Équipe ». Rien d'existant n'est modifié.

Dans cet onglet :

- Un sélecteur de tour (R1, R2, …) en haut, avec le dernier tour clôturé sélectionné par défaut.
- La liste des coureurs enchéris pendant ce tour, triée par montant le plus élevé décroissant (le montant gagnant, ou la meilleure enchère si le coureur n'a pas été attribué).
- Chaque ligne coureur affiche : nom du coureur, équipe, cote initiale, montant retenu, nombre d'enchérisseurs, et le manager gagnant (badge « Attribué ») ou un badge « Non attribué » (égalité / aucun gagnant).
- En dépliant une ligne : toutes les enchères sur ce coureur, du plus haut au plus bas montant, chacune avec le manager, le montant, et un marqueur gagnée / perdue. Mes propres enchères sont mises en évidence.
- Un champ de recherche (coureur ou manager) et un compteur de coureurs pour le tour.
- Mobile : cartes empilables et dépliables au lieu du tableau ; desktop : tableau avec lignes dépliables.

## Détails techniques

- Nouveau composant `src/components/auction/v2/RoundRecapTab.tsx`.
  - Requête React Query sur la vue existante `bids_outcomes`, filtrée par `phase_id`, `round_number` et `league_id` (quand présent), sans filtre `manager_id` ni `outcome` — on récupère donc toutes les enchères de tous les managers, avec jointure `managers!inner(nom, avatar_url)`.
  - Déduplication par `bid_id` (même précaution que `RoundHistoryTab`).
  - Regroupement en mémoire par `coureur_id` : montant retenu = `winning_amount` s'il existe, sinon max des `my_bid` ; gagnant = ligne dont `outcome = 'won'` (absent ⇒ « Non attribué ») ; tri des groupes par montant retenu décroissant puis nom.
  - Affichage des montants via `formatAmount`, dépliage via `Collapsible`, `useIsMobile` pour la variante mobile.
- Câblage dans `src/components/auction/v2/AuctionPhaseHistoryView.tsx` : nouveau `TabsTrigger` « Récap par tour » (icône `ListOrdered`) + `TabsContent` correspondant, inséré après « Base de données ». Les rounds clôturés sont déjà chargés dans ce composant et servent au sélecteur de tour.
- Textes ajoutés dans `src/i18n/locales/{fr,en}/auction.json` sous une clé `roundRecap` (titre, tour, coureur, cote, montant, enchérisseurs, attribué, non attribué, gagnée, perdue, recherche, aucun résultat).
- Aucun changement de base de données : `bids_outcomes` contient déjà les colonnes nécessaires (`coureur_nom`, `coureur_equipe`, `my_bid`, `winning_amount`, `winning_manager`, `outcome`, `round_number`, `league_id`).
