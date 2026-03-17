

## Bug : Round 5 ouvert alors que tous les rosters sont complets

### Cause racine

La chaîne automatique est : `clore-round` → `publier-annonce` → `ouvrir-nouveau-round`.

Quand toutes les annonces d'un round sont publiées, `publier-annonce` appelle systématiquement `ouvrir-nouveau-round` **sans jamais vérifier si tous les managers ont déjà rempli leurs équipes**. Ni `publier-annonce` ni `ouvrir-nouveau-round` ne consultent `managers_rosters_status` pour voir si `slots_restants = 0` pour tous les managers.

### Correction

**`supabase/functions/publier-annonce/index.ts`** — Aux deux endroits où le code auto-lance le round suivant (lignes ~104 et ~175), ajouter une vérification **avant** d'appeler `ouvrir-nouveau-round` :

1. Requêter `managers_rosters_status` pour la `phase_id` et `league_id` du round actuel
2. Vérifier que **tous** les managers ont `slots_restants > 0` (au moins un manager a encore besoin de coureurs)
3. Si tous les rosters sont complets (`slots_restants = 0` pour tous), **ne pas** ouvrir de nouveau round et logger un message explicatif

```
// Pseudo-code de la vérification à ajouter
const { data: rosterStatuses } = await supabase
  .from('managers_rosters_status')
  .select('manager_id, slots_restants')
  .eq('phase_id', currentAuction.phase_id)
  .eq('league_id', currentAuction.league_id);

const allComplete = rosterStatuses?.every(m => m.slots_restants === 0);

if (allComplete) {
  console.log('✅ All rosters complete — no next round needed');
  // Skip ouvrir-nouveau-round call
} else {
  // Proceed with ouvrir-nouveau-round
}
```

Aucun changement nécessaire dans `ouvrir-nouveau-round` lui-même (la garde est mieux placée dans `publier-annonce` qui décide de l'appeler).

### Fichier modifié
- `supabase/functions/publier-annonce/index.ts` (2 blocs de code identiques à modifier, lignes ~103-132 et ~174-205)

