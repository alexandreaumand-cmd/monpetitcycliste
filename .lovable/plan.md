# Meilleur ratio coureur (cette ligue / all-time)

Ajouter deux stats à la fiche Manager, dans le bloc « Palmarès & ligues », à côté du coureur fétiche et du coureur préféré :

- **Meilleur ratio (cette ligue)** : le coureur du manager ayant le meilleur rapport points / prix de signature sur une phase, dans la ligue et la saison affichées.
- **Meilleur ratio (all-time)** : le même calcul, mais sur toutes les ligues et toutes les saisons du manager.

Chaque stat affiche le nom du coureur, la phase concernée (et la ligue pour l'all-time), le ratio en pts/crédit, ainsi que les points et le prix qui le composent.

Règles de calcul :

- Le ratio est calculé **par phase** : points marqués par le coureur pendant cette phase ÷ prix de signature payé pour cette phase.
- Les coureurs signés à prix 0 ou nul sont exclus pour éviter des ratios infinis.
- Un coureur sans point sur la phase donne un ratio de 0 (il peut être « meilleur » seulement s'il n'existe rien d'autre).
- En cas d'égalité parfaite, on garde le coureur avec le plus de points, puis le nom par ordre alphabétique.

## Détails techniques

1. Migration : étendre `get_manager_extra_stats` avec 8 colonnes de retour :
   - `best_ratio_rider_nom`, `best_ratio_value`, `best_ratio_points`, `best_ratio_price`, `best_ratio_phase_label` (périmètre ligue/saison, via le CTE `my_rosters` existant enrichi de `prix_signature`)
   - `best_ratio_rider_nom_all`, `best_ratio_value_all`, `best_ratio_points_all`, `best_ratio_price_all`, `best_ratio_phase_label_all`, `best_ratio_league_nom_all` (périmètre `all_rosters`, joint sur `leagues` et `phases`)
   - Les points viennent de `points_ledger` agrégés par `(coureur_id, phase_id)`, en cohérence avec le calcul du coureur fétiche déjà en place.
   - Le libellé de phase reprend `phases.index_dans_saison` (ex. « P3 »), plus l'année de la saison pour l'all-time.
2. `src/pages/ManagerProfile.tsx` : ajouter les deux cartes de stat en réutilisant le style des cartes existantes et le formatage ROI de `src/domain/stats/roi.ts` (`formatROICompact`).
3. Traductions : nouvelles clés dans `src/i18n/locales/fr/rankings.json` et `en/rankings.json`.

Aucun impact sur les autres écrans ; la fonction reste `STABLE SECURITY DEFINER` et le cache client de 10 min est conservé.
