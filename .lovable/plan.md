

## Fix : la page Résultats affiche des courses hors scope temporel de la ligue

### Cause racine

La fonction SQL `results_courses_with_entries` filtre les courses via `get_league_course_ids(p_league_id)`, qui retourne toutes les courses des phases de la ligue — mais **ignore `started_at_effective`**. La ligue "TEST Saison entière 3 managers" a `started_at_effective = 2026-03-27`, donc Paris-Nice (8-15/03), Volta Catalunya (23-29/03 mais début < 27), etc. ne devraient pas apparaître.

Les vues standings utilisent déjà ce filtre (`c.date_debut >= started_at_effective`), mais `results_courses_with_entries` ne le fait pas.

### Solution

Modifier `results_courses_with_entries` pour ajouter un filtre `started_at_effective` quand `p_league_id` est fourni :

```sql
AND (p_league_id IS NULL OR (
  c.id IN (SELECT course_id FROM get_league_course_ids(p_league_id))
  AND c.date_debut >= COALESCE(
    (SELECT l.started_at_effective FROM leagues l WHERE l.id = p_league_id),
    '1900-01-01'
  )::date
))
```

Cela filtre les courses en combinant le scope de la ligue ET la date plancher.

### Fichier impacté
- **Migration SQL** — recréation de `results_courses_with_entries` avec filtre `started_at_effective`

