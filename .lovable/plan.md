

## Filtrer les bonus coureur par scope de la ligue

### Problème
Le trigger `trigger_calculate_bonus_rider` crée des `bonus_points` pour chaque insertion dans `points_ledger`, même pour des courses hors du scope de la ligue. La table `bonus_points` n'a pas de colonne `course_id`, donc les requêtes en aval (`manager_team_by_id`, `manager-my-team`) ne peuvent pas filtrer ces bonus par course autorisée.

Résultat : Noa Isidore affiche 50 pts (bonus coureur de 25% sur des points hors scope) dans la ligue Flandriennes 2026.

### Solution

**1. Migration SQL**

- **Ajouter `course_id`** à la table `bonus_points` (nullable, FK vers `courses`)
- **Backfill** : extraire le `course_id` depuis le champ `commentaire` (format `... - {course_id} - ...`)
- **Mettre à jour le trigger** `trigger_calculate_bonus_rider` pour écrire `NEW.course_id` dans la nouvelle colonne
- **Mettre à jour la CTE `rider_bonus`** dans `manager_team_by_id` pour filtrer :
  ```sql
  rider_bonus AS (
    SELECT bp.coureur_id, SUM(bp.points) AS bonus_points
    FROM bonus_points bp
    CROSS JOIN current_phase cp
    WHERE bp.phase_id = cp.phase_id
      AND (bp.manager_id = p_manager_id OR bp.target_manager_id = p_manager_id)
      AND bp.coureur_id IS NOT NULL
      AND (p_league_id IS NULL OR bp.league_id = p_league_id)
      AND (p_league_id IS NULL OR bp.course_id IS NULL 
           OR bp.course_id IN (SELECT course_id FROM allowed_courses))
      AND (p_league_id IS NULL OR bp.course_id IS NULL
           OR bp.course_id IN (
             SELECT c.id FROM courses c, league_info li
             WHERE c.date_debut >= li.effective_start
           ))
    GROUP BY bp.coureur_id
  )
  ```

**2. Edge function `manager-my-team`**

- Lignes 286-294 : ajouter un filtre `course_id` sur la requête `riderBonusQuery` :
  ```typescript
  if (courseFilter) {
    riderBonusQuery = riderBonusQuery.in('course_id', courseFilter);
  }
  ```

**3. Edge function `get-my-team-kpis`**

- Même logique : filtrer les `bonus_points` de type `coureur_bonuse` par `courseFilter`

### Fichiers impactés
- 1 migration SQL (alter table + backfill + trigger + fonction)
- `supabase/functions/manager-my-team/index.ts`
- `supabase/functions/get-my-team-kpis/index.ts`

### Résultat attendu
- Flandriennes 2026 : Noa Isidore → 0 pts (aucune course sélectionnée n'a de résultats)
- Ligues classiques : aucun changement (tous les bonus ont un `course_id` dans le scope)

