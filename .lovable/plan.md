## Objectif

Intégrer la table `bonus_points` dans le RPC `get_weekly_points_heatmap` pour que la vue Hebdo affiche les mêmes totaux que la vue Managers. La vue `v_manager_standings_by_season_v2` reste inchangée.

## Migration

Recréer `public.get_weekly_points_heatmap(uuid, uuid)` avec une nouvelle CTE `rider_bonus_weekly` ajoutée à l'UNION ALL existante.

### Règles de mapping pour `bonus_points`

- **Manager**: `COALESCE(bp.manager_id, bp.target_manager_id)`
- **Semaine**:
  - Si `bp.course_id` renseigné → `EXTRACT(WEEK FROM courses.date_debut)`
  - Sinon → dernière semaine active de la phase (même logique que `manager_bonus_weekly` via LATERAL sur `points_ledger`)
- **Filtres**:
  - `bp.league_id = p_league_id`
  - `phases.saison_id = p_saison_id`
  - Si `course_id` non null : course ∈ `allowed_courses` ET `date_debut >= date_floor`
  - Points ≠ 0 (inclut malus négatifs)

### Structure SQL

```sql
rider_bonus_weekly AS (
  SELECT
    COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
    m.nom AS manager_nom,
    COALESCE(
      EXTRACT(WEEK FROM c.date_debut)::int,
      latest_week.week_number
    ) AS week_number,
    bp.points::numeric AS total_points
  FROM bonus_points bp
  JOIN managers m ON m.id = COALESCE(bp.manager_id, bp.target_manager_id)
  JOIN phases p ON p.id = bp.phase_id
  LEFT JOIN courses c ON c.id = bp.course_id
  CROSS JOIN league_info li
  LEFT JOIN LATERAL (
    SELECT MAX(EXTRACT(WEEK FROM COALESCE(csc3.stage_date, rr3.date_classement)))::int AS week_number
    FROM points_ledger pl3
    JOIN race_results rr3 ON rr3.course_id = pl3.course_id
      AND rr3.coureur_id = pl3.coureur_id
      AND rr3.type_classement = pl3.type_classement
      AND COALESCE(rr3.etape_numero,0) = COALESCE(pl3.etape_numero,0)
    LEFT JOIN course_stage_config csc3 ON csc3.course_id = pl3.course_id
      AND csc3.etape_numero = pl3.etape_numero
    JOIN courses c3 ON c3.id = pl3.course_id
    WHERE pl3.phase_id = bp.phase_id
      AND c3.date_debut >= li.date_floor
      AND pl3.course_id IN (SELECT course_id FROM allowed_courses)
  ) latest_week ON TRUE
  WHERE p.saison_id = p_saison_id
    AND bp.league_id = p_league_id
    AND COALESCE(bp.manager_id, bp.target_manager_id) IS NOT NULL
    AND bp.points <> 0
    AND (
      c.id IS NULL
      OR (c.id IN (SELECT course_id FROM allowed_courses) AND c.date_debut >= li.date_floor)
    )
)
```

Puis ajout à l'`UNION ALL`:
```sql
UNION ALL
SELECT manager_id, manager_nom, week_number, total_points FROM rider_bonus_weekly
WHERE week_number IS NOT NULL
```

## Inchangé

- `v_manager_standings_by_season_v2` (vue Managers)
- `manager_bonus_weekly` et `race_week_points`
- Frontend (`WeeklyHeatmap.tsx`, `PerformanceHeatmap.tsx`)

## Résultat attendu

Les écarts −75 (JP) et −25 (Fab/Max/Ludo/Alex) disparaissent. Les bonus liés à une course s'affichent dans la semaine de la course ; les bonus globaux dans la dernière semaine active de la phase.