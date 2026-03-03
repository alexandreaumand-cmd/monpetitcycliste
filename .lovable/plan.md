

## Diagnostic confirmé

Les résultats pour `ename_samyn_classic` sont bien en base **Live** (10 lignes, Meeus P1) mais :
- `points = 0` sur toutes les lignes
- `result_set_id = NULL` (non rattachés à un result_set)
- `points_ledger` vide
- Aucun log d'exécution des edge functions `compute-points` ou `admin-result-save-lot`

**Cause racine** : le calcul de points (`admin_compute_points_for_course`) n'a jamais été exécuté après l'insertion des résultats. Les résultats semblent avoir été insérés sans passer par le flux standard (edge function).

## Solution proposée

### Action immédiate (sans code)
Utiliser l'onglet **"Recalcul Points"** dans l'admin pour relancer `compute-points` sur `ename_samyn_classic`. Cela appellera `admin_compute_points_for_course` et remplira le `points_ledger`.

### Amélioration préventive (changement de code)
Ajouter un **garde-fou automatique** dans le composant `PointsComputeManager` ou dans le flux de saisie :

1. **Vérification post-save** dans `ResultsEntryStudio.desktop.tsx` : après l'appel à `compute-points`, vérifier que `points_ledger` contient bien des entrées. Si ce n'est pas le cas, retenter le calcul et afficher un avertissement explicite.

2. **Détection des courses "orphelines"** dans l'onglet Résultats admin : afficher un badge d'alerte sur les courses qui ont des `race_results` mais un `points_ledger` vide, pour que l'admin puisse relancer le calcul manuellement.

### Fichiers impactés
- `src/components/admin/ResultsEntryStudio.desktop.tsx` : ajout d'une vérification post-compute
- `src/components/admin/RecentResults.tsx` : ajout d'un indicateur visuel pour les courses sans points calculés

