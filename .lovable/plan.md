

# Corriger la jointure ambiguë dans clore-round

## Problème
La fonction `clore-round` échoue en LIVE avec l'erreur PostgREST `PGRST201` : deux foreign keys entre `auctions` et `phases` (`phase_id` et `effective_phase_id`) rendent la jointure ambiguë.

## Correction

### Fichier : `supabase/functions/clore-round/index.ts`
**Ligne ~97** : Remplacer la jointure inutile par un simple `select('*')`.

```typescript
// Avant
.select('*, phases!auctions_phase_id_fkey(*)')

// Après
.select('*')
```

Les données de `phases` ne sont jamais utilisées dans la suite du code — seuls `effective_phase_id` et `phase_id` (colonnes directes de `auctions`) sont nécessaires.

### Après déploiement
Tester manuellement la clôture du round bloqué sur la ligue "Test DL" via l'interface admin ou un appel direct à `clore-round`.

