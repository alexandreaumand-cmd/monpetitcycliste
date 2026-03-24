

# Afficher la valeur correspondante au tri sélectionné

## Problème
Quand on trie par victoires ou scoreurs, le gros chiffre affiché reste `total_points`. Il devrait afficher la valeur du critère de tri sélectionné.

## Solution

### Mobile — `src/pages/Rankings.mobile.tsx`

1. Modifier `PointsBadge` pour accepter aussi le `sortBy` et les données du standing
2. À la ligne 426, passer la bonne valeur selon `standingsSortBy` :
   - `points` → `standing.total_points`
   - `victories` → `standing.nb_victoires ?? standing.victories_count ?? 0`
   - `scorers` → `standing.nb_scoreurs ?? standing.scoreurs_count ?? 0`
3. Ajouter un petit label sous le chiffre (ex: "pts", "vic.", "scor.") pour contextualiser

### Desktop — `src/components/rankings/ManagerStandings.tsx`

Le desktop affiche déjà toutes les colonnes (points, victoires, scoreurs) dans le tableau, donc pas de changement nécessaire — toutes les valeurs sont visibles. On peut optionnellement mettre en gras la colonne correspondant au tri actif.

### Fichiers modifiés
- `src/pages/Rankings.mobile.tsx` — adapter `PointsBadge` et son appel
- `src/components/rankings/ManagerStandings.tsx` — highlight optionnel de la colonne triée

