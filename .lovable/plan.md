

## Filtrer les points des courses antérieures à la création de la ligue

### Problème

La ligue « Ligue Publique WT sans bonus » a été créée le 25 mars 2026 mais `started_at_effective` est NULL (pas encore d'enchère terminée). Partout dans le code SQL, la condition est :

```sql
WHERE (l.started_at_effective IS NULL OR c.date_debut >= l.started_at_effective)
```

Quand `started_at_effective` est NULL, **aucun filtre de date** n'est appliqué → toutes les courses WT de la saison comptent, y compris celles antérieures à la création.

Ce problème touche :
- `get_top_riders_optimized` (onglet Top Coureurs — visible sur la capture)
- `v_manager_standings_by_phase_v2` (classement par phase)
- `v_manager_standings_by_season_v2` (classement saison)
- `manager_team_by_id` (Mon Équipe)

### Solution

**Une seule migration SQL** qui modifie la logique de fallback partout : quand `started_at_effective` est NULL, utiliser `leagues.created_at::date` comme date plancher.

#### Changements dans la migration :

1. **`get_top_riders_optimized`** — Remplacer :
   ```sql
   v_started_at_effective := l.started_at_effective
   ```
   par :
   ```sql
   v_started_at_effective := COALESCE(l.started_at_effective, l.created_at)
   ```
   Cela supprime la condition `IS NULL` qui court-circuitait le filtre.

2. **`v_manager_standings_by_phase_v2`** et **`v_manager_standings_by_season_v2`** — Dans toutes les CTEs (`race_pts`, `scoreurs`, `victories`), remplacer :
   ```sql
   (l.started_at_effective IS NULL OR c.date_debut >= l.started_at_effective)
   ```
   par :
   ```sql
   c.date_debut >= COALESCE(l.started_at_effective, l.created_at)::date
   ```

3. **`manager_team_by_id`** — Même correction si `started_at_effective IS NULL` y est utilisé.

### Résultat attendu
- « Ligue Publique WT sans bonus » : 0 points partout (aucune course WT n'a débuté le 25 mars ou après avec des résultats)
- Ligues avec `started_at_effective` renseigné : aucun changement
- Ligues anciennes (créées en début de saison) : comportement identique car `created_at` est antérieur aux premières courses

### Fichiers impactés
- 1 nouvelle migration SQL (recréation des vues + fonction)
- Aucun changement frontend

