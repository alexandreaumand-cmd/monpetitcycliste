

# Fix: Roster-to-manager mapping ignores phase in StartlistTrackerMovements

## Probleme

Dans `StartlistTrackerMovements.tsx` ligne 104-118, la requete roster qui mappe coureur_id vers un manager ne filtre pas par `phase_id` :

```typescript
.eq("league_id", leagueId)  // ← pas de filtre phase_id
```

Resultat : Magagnotti, qui etait dans l'equipe de Ludo en phase 1 mais plus en phase 2, apparait quand meme avec "Ludo" comme manager sur les courses de phase 2.

## Solution

Ajouter `.eq("phase_id", phaseId)` a la requete roster (ligne 110).

### Fichier modifie
- `src/components/startlist/StartlistTrackerMovements.tsx` — ajouter le filtre `phase_id` a la requete roster ligne 110, et ajouter `phaseId` dans la queryKey ligne 105.

