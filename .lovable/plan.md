# Réparer définitivement le recalcul des points du Czech Tour

## Diagnostic confirmé

- Les tentatives de recalcul de `czech_tour` à 12:40 et 12:43 atteignent bien la fonction backend `admin-recompute-course`.
- Elles échouent dans le déclencheur du bonus coureur avec l’erreur PostgreSQL `42P10` : `there is no unique or exclusion constraint matching the ON CONFLICT specification`.
- La correction précédente cible six colonnes dans `ON CONFLICT`, mais l’unicité correspondante est un **index partiel** (`bonus_points_unique_rider_bonus`). PostgreSQL exige que la clause reprenne aussi le prédicat de cet index ; sinon toute la transaction de points est annulée.
- Le message rouge générique visible à l’écran masque actuellement ce détail utile.

## Correction

1. **Corriger le déclencheur de bonus**
   - Modifier `trigger_calculate_bonus_rider()` pour que son `ON CONFLICT` cible explicitement le même prédicat que l’index partiel : coureur, manager et course non nuls.
   - Conserver le calcul cumulé à 25 % par coureur / manager / ligue / course introduit précédemment.

2. **Rejouer le Czech Tour**
   - Relancer `admin_compute_points_for_course('czech_tour')` après la migration.
   - Vérifier que les lignes de l’étape 4 et des classements finaux sont créées dans le ledger, notamment les points de Fancellu pour Fab.
   - Vérifier que le bonus coureur est cumulé sans doublon.

3. **Afficher l’erreur backend réelle**
   - Dans l’écran Super Admin « Recalcul Points », extraire le corps de la réponse de la fonction lorsqu’elle renvoie un statut non-2xx.
   - Remplacer le message générique « Edge Function returned a non-2xx status code » par l’erreur précise renvoyée par le backend, tout en conservant un message de secours.

## Validation

- Recalcul de `czech_tour` terminé avec un statut 2xx.
- Présence des points pour l’étape 4, Général, Points, Montagne et Jeune.
- Contrôle du total de Fancellu/Fab et absence de doublons dans les bonus.
- Vérification du toast de succès, puis test d’un échec contrôlé pour confirmer la remontée d’erreur détaillée.
