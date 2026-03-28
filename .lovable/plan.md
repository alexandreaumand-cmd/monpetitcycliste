

## Fix : les statistiques ignorent le scope de la ligue (phases hors périmètre)

### Problème

**6 edge functions** de statistiques récupèrent **toutes les phases de la saison** sans consulter `league_scopes.phases` ni `starting_phase_index`. Pour une ligue P3, elles incluent donc les données des phases 1 et 2.

Fonctions impactées :
1. `get-luck-ranking` — points réels, gros coups, top courses
2. `get-knowledge-ranking` — score, pépites, ratio
3. `get-consistency-scores` — régularité par phase
4. `get-performance-matrix` — heatmap par phase
5. `get-points-distribution` — distribution par phase
6. `get-predictions` — prédictions par phase

La fonction `get-team-category-stats` ne reçoit même pas de `league_id` et utilise toutes les phases actives de la saison.

### Solution

Ajouter dans chaque fonction un appel à `league_scopes` pour filtrer les phases :

```typescript
// Récupérer les phases scopées de la ligue
const { data: scopeData } = await supabase
  .from('league_scopes')
  .select('phases')
  .eq('league_id', league_id)
  .single();

const scopedPhaseIds = scopeData?.phases || [];

// Filtrer les phases récupérées
const filteredPhases = phases.filter(p => scopedPhaseIds.includes(p.id));
const phaseIds = filteredPhases.map(p => p.id);
```

### Détail par fonction

1. **`get-luck-ranking`** (lignes 49-53) : Après le fetch des phases, filtrer par `league_scopes.phases`. Les `points_ledger` et `rosters` utilisent déjà `phaseIds` — il suffit de restreindre ce tableau.

2. **`get-knowledge-ranking`** (lignes 60-69) : Même approche — filtrer `phaseIds` et `phaseLabels` par le scope.

3. **`get-consistency-scores`** (lignes 67-74) : Filtrer les phases par scope avant de calculer les scores.

4. **`get-performance-matrix`** (lignes 67-74) : Filtrer les phases par scope.

5. **`get-points-distribution`** (lignes 136-142) : Filtrer les phases par scope.

6. **`get-predictions`** (lignes 129-136) : Filtrer les phases par scope.

7. **`get-team-category-stats`** (lignes 14-26) : Ajouter le paramètre `league_id` dans le body, et filtrer les `activePhaseIds` par `league_scopes.phases`. Côté frontend (`CategoryWeight.tsx` et `TeamPointsBreakdown.tsx`), passer `league_id` dans l'appel.

### Fichiers impactés
- `supabase/functions/get-luck-ranking/index.ts`
- `supabase/functions/get-knowledge-ranking/index.ts`
- `supabase/functions/get-consistency-scores/index.ts`
- `supabase/functions/get-performance-matrix/index.ts`
- `supabase/functions/get-points-distribution/index.ts`
- `supabase/functions/get-predictions/index.ts`
- `supabase/functions/get-team-category-stats/index.ts`
- `src/components/rankings/CategoryWeight.tsx` — passer `league_id`
- `src/components/rankings/TeamPointsBreakdown.tsx` — passer `league_id`

