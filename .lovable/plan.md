## Diagnostic

Il n'y a **aucune limite** sur le nombre de coureurs côté code (ni broadcast, ni RPC, ni stockage). J'ai vérifié le dernier broadcast en base : les coureurs sont bien stockés (`riderCount: 23`, 5 noms listés, payload jsonb intact, dupliqué dans chaque ligue).

La cause est dans `src/components/arena/RaceSituationDisplay.tsx` :

```ts
const showRiders = !group.isPeloton && riderItems.length > 0;
```

Le groupe diffusé est nommé « Peloton » et flaggé `isPeloton: true` (l'échappée a été marquée comme peloton dans l'éditeur — les deux groupes du dernier broadcast le sont). Du coup, la liste de coureurs est volontairement masquée à l'affichage, alors que les données sont bien là.

## Plan

1. **`RaceSituationDisplay.tsx`** : changer la règle pour afficher les coureurs dès qu'il y en a, peu importe `isPeloton` :
   ```ts
   const showRiders = riderItems.length > 0;
   ```
   Le badge « P » et le compteur `(n)` restent gérés par `isPeloton`, mais la liste nominale s'affiche si l'admin a saisi des coureurs (typique : leaders dans le peloton, ou breakaway taggé peloton par erreur).

2. **`RaceSituationEditor.tsx`** : aucune modification fonctionnelle — l'éditeur permet déjà de saisir > 5 coureurs sans cap. Le collapsible « +N autres » de l'affichage gère déjà les listes longues (au-delà de 5 visibles).

## Notes

- À plus long terme, on pourrait aussi forcer un seul groupe `isPeloton` à la fois dans l'éditeur (actuellement `setPeloton` le fait, mais l'import depuis broadcast existant peut en avoir plusieurs). À traiter séparément si tu veux.
- Aucun changement de schéma, ni RLS, ni edge function.
