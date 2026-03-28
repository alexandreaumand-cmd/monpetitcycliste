

## Fix : le dialog "Coureurs bonusés" affiche des points hors scope de la ligue

### Cause racine

Dans `LeagueBonusRidersDialog.tsx`, les requêtes `points_ledger` (ligne 114) et `bonus_points` (ligne 130) filtrent uniquement par `phase_id` — elles ignorent complètement le scope de la ligue (courses autorisées + date plancher `started_at_effective`).

Résultat : Noa Isidore affiche 250 points et +62.5 bonus alors qu'il n'a aucun point **dans cette ligue**.

### Solution

Ajouter le filtrage par scope de ligue dans les deux requêtes :

1. **Récupérer les course_ids autorisées** via `get_league_course_ids(leagueId)` + la date `started_at_effective` de la ligue
2. **Filtrer `points_ledger`** avec `.in('course_id', leagueCourseIds)` et exclure les courses avant la date plancher
3. **Filtrer `bonus_points`** de la même façon (les bonus avec `course_id` doivent être dans le scope)

### Détails techniques

Dans `LeagueBonusRidersDialog.tsx`, avant les requêtes de points :

```typescript
// Get league scope
const { data: leagueCourseIds } = await supabase.rpc('get_league_course_ids', { p_league_id: leagueId });
const validCourseIds = leagueCourseIds?.map((r: any) => r.course_id) || [];

const { data: leagueData } = await supabase
  .from('leagues')
  .select('started_at_effective')
  .eq('id', leagueId)
  .single();

// If date floor, filter courses by date
let scopedCourseIds = validCourseIds;
if (leagueData?.started_at_effective && validCourseIds.length > 0) {
  const dateFloor = leagueData.started_at_effective.substring(0, 10);
  const { data: coursesData } = await supabase
    .from('courses')
    .select('id, date_debut')
    .in('id', validCourseIds);
  scopedCourseIds = (coursesData || [])
    .filter(c => c.date_debut && c.date_debut > dateFloor)
    .map(c => c.id);
}
```

Puis filtrer les deux requêtes avec `.in('course_id', scopedCourseIds)`.

### Fichier impacté
- `src/components/team/LeagueBonusRidersDialog.tsx` — ajout filtrage scope ligue sur points_ledger et bonus_points

