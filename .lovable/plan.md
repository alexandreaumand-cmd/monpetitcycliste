## Problème

Dans la ligue **Suceurs_de_Roux** (LIVE), la phase 3 a été choisie comme phase de départ (`starting_phase_index = 3`, `started_at_effective = 2026-05-08`). Le **Giro d'Italia** commence aussi le **2026-05-08** (`date_debut`).

La fonction `get_league_courses_with_points` filtre les courses avec une comparaison **strictement supérieure** :

```sql
(l.starting_phase_index IS NOT NULL
  AND l.started_at_effective IS NOT NULL
  AND vcp.date_debut > l.started_at_effective)
```

Comme `2026-05-08 > 2026-05-08` est faux, le Giro est exclu — alors que c'est précisément la première course de la phase de départ.

## Correction proposée

Remplacer `>` par `>=` dans la branche `starting_phase_index IS NOT NULL` (et de manière cohérente dans la branche par défaut), via une migration SQL qui recrée la fonction :

```sql
CREATE OR REPLACE FUNCTION public.get_league_courses_with_points(
  p_league_id uuid, p_season_id uuid DEFAULT NULL
)
RETURNS SETOF v_course_points_theoriques
LANGUAGE sql STABLE AS $$
  SELECT vcp.*
  FROM v_course_points_theoriques vcp
  WHERE vcp.course_id IN (SELECT course_id FROM get_league_course_ids(p_league_id))
    AND (p_season_id IS NULL OR vcp.phase_id IN (
      SELECT id FROM phases WHERE saison_id = p_season_id
    ))
    AND EXISTS (
      SELECT 1 FROM leagues l
      WHERE l.id = p_league_id
        AND (
          (l.starting_phase_index IS NULL
            AND vcp.date_debut >= COALESCE(l.started_at_effective, l.created_at::date))
          OR
          (l.starting_phase_index IS NOT NULL
            AND l.started_at_effective IS NOT NULL
            AND vcp.date_debut >= l.started_at_effective)
        )
    )
  ORDER BY vcp.date_debut DESC;
$$;
```

## Effet attendu

Le Giro d'Italia (et toute course commençant pile le jour de la phase de départ) apparaîtra dans la liste des courses de la ligue.
