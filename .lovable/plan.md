

## Filtrer les onglets Hebdo et Chrono par scope de la ligue

### Problème
Les onglets "Hebdo" (`get_weekly_points_heatmap`) et "Chrono" (`get-cumulative-points-series`) ne filtrent pas les points par les courses autorisées de la ligue ni par la date de démarrage effective. Ils agrègent **tous** les points de la saison/phase, ce qui affiche des points fantômes dans les ligues "à la course" comme "Flandriennes 2026".

### Solution

**1. Migration SQL — `get_weekly_points_heatmap`**

Ajouter le filtrage par `get_league_course_ids` et par date plancher `COALESCE(started_at_effective, created_at)` dans la CTE `race_week_points` :

```sql
JOIN courses c ON c.id = pl.course_id
JOIN leagues l ON l.id = p_league_id
WHERE p.saison_id = p_saison_id
  AND c.date_debut >= COALESCE(l.started_at_effective, l.created_at)::date
  AND pl.course_id IN (SELECT glc.course_id FROM get_league_course_ids(p_league_id) glc)
```

Même filtre dans la CTE `manager_bonus_weekly` (points de bonus liés aux courses hors scope).

**2. Edge function — `get-cumulative-points-series`**

Fichier : `supabase/functions/get-cumulative-points-series/index.ts`

Après chargement de `pointsData`, filtrer les `course_id` par le scope de la ligue :
- Appeler `get_league_course_ids(league_id)` via `supabase.rpc()` pour obtenir la liste des courses autorisées
- Charger `started_at_effective` et `created_at` depuis `leagues` pour la date plancher
- Filtrer `pointsData` pour ne garder que les points dont le `course_id` est dans la liste autorisée et dont la date de la course est ≥ date plancher
- Appliquer le même filtre aux bonus (`bonusManagerData`, `bonusRiderData`) si leurs phases contiennent des courses hors scope

### Résultat attendu
- "Flandriennes 2026" : 0 points dans Hebdo et Chrono (aucune course sélectionnée n'a encore de résultats)
- Ligues "5 Phases" classiques : comportement inchangé

### Fichiers impactés
- 1 nouvelle migration SQL (recréation de `get_weekly_points_heatmap`)
- `supabase/functions/get-cumulative-points-series/index.ts`

