

## Fix : la page Résultats affiche des courses hors scope quand `started_at_effective` est NULL

### Problème

La fonction SQL `results_courses_with_entries` utilise ce fallback quand `started_at_effective` est NULL :

```sql
c.date_debut > COALESCE(l.started_at_effective::date, '1900-01-01'::date)
```

Pour une ligue dont les enchères n'ont pas encore été clôturées, `started_at_effective` est NULL → fallback à 1900 → **toutes les courses passent le filtre de date**, même celles des phases 1 et 2.

Les vues matérialisées (`v_manager_standings_by_phase_v2`, etc.) utilisent correctement `COALESCE(l.started_at_effective, l.created_at)` comme fallback, mais la fonction `results_courses_with_entries` est incohérente.

### Solution

Aligner le fallback de `results_courses_with_entries` sur celui des vues : utiliser `l.created_at` au lieu de `'1900-01-01'`.

```sql
-- Avant
c.date_debut > COALESCE(
  (SELECT l.started_at_effective::date FROM leagues l WHERE l.id = p_league_id),
  '1900-01-01'::date
)

-- Après
c.date_debut > COALESCE(
  (SELECT l.started_at_effective::date FROM leagues l WHERE l.id = p_league_id),
  (SELECT l.created_at::date FROM leagues l WHERE l.id = p_league_id)
)
```

Ainsi, pour une ligue créée récemment (ex: mars 2026) avec enchères en cours, seules les courses postérieures à la date de création de la ligue seront affichées — excluant les courses de janvier/février qui appartiennent aux phases 1-2.

### Fichier impacté
- Migration SQL : `CREATE OR REPLACE FUNCTION results_courses_with_entries` — changer le fallback de `'1900-01-01'` à `l.created_at`

