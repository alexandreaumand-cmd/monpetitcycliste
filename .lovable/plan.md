

# Fix: Mouvements startlists affiche des coureurs hors-phase

## Problème

La requête roster (ligne 25-29) filtre par `manager_id` + `league_id` mais **pas par `phase_id`**. Elle récupère donc tous les coureurs de toutes les phases du manager, au lieu de ceux de la phase sélectionnée uniquement.

## Solution

Ajouter `.eq("phase_id", phaseId)` à la requête roster dans `TeamStartlistMovements.tsx`.

### Fichier modifié
- `src/pages/TeamStartlistMovements.tsx` — ajouter le filtre `phase_id` à la requête roster (ligne 29)

