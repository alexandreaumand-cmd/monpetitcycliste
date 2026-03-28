

## Fix : le `starting_phase_index` est ignoré — les ligues P3 voient toutes les phases

### Problème racine (2 bugs)

**Bug 1 — `leagues-create/index.ts` ligne 96** : le `startingPhaseIndex` reçu du frontend est immédiatement écrasé par `null` :
```typescript
leagueStartingPhaseIndex = typeof startingPhaseIndex === 'number' ? startingPhaseIndex : null;
leagueStartingPhaseIndex = null;  // ← BUG : écrase la valeur
```
Résultat : `starting_phase_index` est toujours `null` en base, et `scope.phases` contient les 5 phases au lieu de seulement les phases 3, 4, 5.

**Bug 2 — `get_league_course_ids` SQL** : même si `starting_phase_index` était correctement stocké, la fonction SQL ne le consulte jamais. Elle retourne les courses de TOUTES les phases listées dans `scope.phases`.

**Bug 3 — `get_league_courses_with_points` SQL** : utilise encore `'1900-01-01'` comme fallback au lieu de `created_at`.

### Solution

#### 1. Fix `leagues-create/index.ts`
- **Supprimer la ligne 96** (`leagueStartingPhaseIndex = null;`)
- **Filtrer `phaseUuids`** pour ne garder que les phases à partir de `startingPhaseIndex` :
```typescript
if (typeof startingPhaseIndex === 'number') {
  phaseUuids = phases
    .filter(p => p.index_dans_saison >= startingPhaseIndex)
    .map(p => p.id);
} else {
  phaseUuids = phases.map(p => p.id);
}
```
Cela garantit que `scope.phases` ne contient que les phases 3, 4, 5 pour une ligue P3.

#### 2. Fix `get_league_course_ids` SQL
Ajouter un filtre sur `starting_phase_index` dans la branche phases :
```sql
-- Dans la branche "phases IS NOT NULL"
AND (
  (SELECT l.starting_phase_index FROM leagues l WHERE l.id = p_league_id) IS NULL
  OR c.phase_id IN (
    SELECT p.id FROM phases p 
    WHERE p.id = ANY(v_scope.phases)
    AND p.index_dans_saison >= (SELECT l.starting_phase_index FROM leagues l WHERE l.id = p_league_id)
  )
)
```
Cela couvre aussi les ligues existantes dont `scope.phases` contient déjà les 5 phases.

#### 3. Fix `get_league_courses_with_points` SQL
Remplacer `'1900-01-01'` par `(SELECT created_at FROM leagues WHERE id = p_league_id)` (même fix que `results_courses_with_entries`).

### Fichiers impactés
- `supabase/functions/leagues-create/index.ts` — supprimer ligne 96, filtrer phases par startingPhaseIndex
- Migration SQL — `get_league_course_ids` + `get_league_courses_with_points`

