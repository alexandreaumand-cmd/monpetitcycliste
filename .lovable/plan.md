

## Fix Comparaison des Managers : décimales et données cross-league

### Problèmes identifiés

1. **Décimales** : `totalPointsA/B` affiche des valeurs brutes comme `4888.13999999999` au lieu d'entiers arrondis
2. **Données cross-league** : les requêtes `points_ledger` et `bonus_points` ne filtrent PAS par `league_id`. Résultat : des points d'AUTRES ligues apparaissent dans la comparaison (la ligue TEST n'a aucun résultat saisi, donc tout devrait être à 0)

### Cause racine

Dans `ManagerComparison.tsx` :
- Lignes 147-169 / 181-204 : `points_ledger` filtré par `coureur_id` + `phase_id` mais **pas par `league_id`**
- Lignes 214-236 / 246-268 : `bonus_points` idem, pas de filtre `league_id`
- Lignes 841/848/853 : `totalPointsA/B` affiché sans `Math.round()`

### Solution

**`src/components/rankings/ManagerComparison.tsx`** :

1. **Ajouter `.eq('league_id', leagueId)`** aux 2 requêtes `points_ledger` (lignes ~148 et ~182)
2. **Ajouter `.eq('league_id', leagueId)`** aux 2 requêtes `bonus_points` (lignes ~215 et ~247)
3. **Appliquer `Math.round()`** sur tous les affichages de points : `totalPointsA`, `totalPointsB`, écarts, et dans les cartes KPI (lignes 841, 848, 853)
4. Désactiver les requêtes quand `!leagueId` (`enabled: !!managerA && !!leagueId`)

### Résultat attendu
- Ligue TEST : tous les compteurs à 0 (aucun résultat saisi)
- Ligue LIVE : valeurs correctes, arrondies, sans décimales

### Fichier impacté
- `src/components/rankings/ManagerComparison.tsx` uniquement

