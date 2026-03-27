

## Fix : exclure E3 Saxo Classic des classements et résultats

### Problème

Le fix précédent a changé `>=` en `>` uniquement dans `get_league_courses_with_points` (onglet Courses). Mais deux autres endroits utilisent encore `>=` :

1. **`results_courses_with_entries`** (onglet Résultats) — ligne 48 : `c.date_debut >= COALESCE(...)` → la course E3 Saxo Classic (même date que `started_at_effective`) apparaît encore
2. **`v_manager_standings_by_phase_v2`** et **`v_manager_standings_by_season_v2`** (classements) — 10 occurrences de `>= COALESCE(l.started_at_effective...)` → les points de E3 Saxo Classic comptent dans les standings

### Solution

Une seule migration SQL qui recrée ces 3 objets en remplaçant **tous** les `>=` par `>` sur le filtre `started_at_effective` :

- `results_courses_with_entries` : ligne 48, `>=` → `>`
- `v_manager_standings_by_phase_v2` : 5 CTEs (race_pts, rider_bonus_pts, scoreurs, victories × `>=`) → `>`
- `v_manager_standings_by_season_v2` : 5 CTEs identiques → `>`

Après le déploiement, rafraîchir les standings matérialisées.

### Fichier impacté
- **Migration SQL** — recréation de `results_courses_with_entries`, `v_manager_standings_by_phase_v2`, `v_manager_standings_by_season_v2` avec `>` au lieu de `>=`

