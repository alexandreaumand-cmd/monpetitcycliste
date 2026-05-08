## Cause

La ligue **Suceurs_de_Roux** (LIVE) a `starting_phase_index = 3` et `started_at_effective = 2026-05-08`. Le **Giro d'Italia 2026** a `date_debut = 2026-05-08` (donc l'étape 1 du 2026-05-08).

La fonction `get_league_courses_with_points` a déjà été corrigée (`>=`), donc la course apparaît bien dans la liste des courses de la ligue.

**Mais les deux fonctions qui calculent les classements n'ont pas été corrigées** et utilisent encore une comparaison stricte :

```sql
(l.starting_phase_index IS NOT NULL
 AND l.started_at_effective IS NOT NULL
 AND c.date_debut > l.started_at_effective)   -- ❌ devrait être >=
```

Concernées :
- `public.get_league_standings_by_season(uuid, uuid)` — 4 occurrences (CTE `race_pts`, `scoreurs`, `victories`)
- `public.get_league_standings_by_phase(uuid, uuid)` — 4 occurrences (mêmes CTE)

Comme `2026-05-08 > 2026-05-08` est faux, **toutes les lignes de points du Giro (étape 1, GC, KOM, etc.) sont exclues du classement** de Suceurs_de_Roux, alors qu'elles existent dans `points_ledger`.

## Correction proposée

Migration SQL qui recrée les deux fonctions à l'identique en remplaçant `c.date_debut >` par `c.date_debut >=` dans la branche `starting_phase_index IS NOT NULL`. Cela aligne les fonctions de standings avec `get_league_courses_with_points` (même règle : la phase de départ inclut les courses qui commencent pile le jour `started_at_effective`).

### Effet attendu

- **Suceurs_de_Roux** : les points du Giro d'Italia (et de toute course commençant pile à `started_at_effective`) remontent immédiatement dans le classement → l'écran « Calcul du classement en cours… » se remplit.
- Aucun impact sur les ligues sans `starting_phase_index` (branche déjà en `>=`).
- Aucun impact sur les ligues dont `started_at_effective` ne tombe pas exactement sur une `date_debut` de course.

### Hors scope

- Pas de changement frontend.
- Pas de touch aux données (pas d'`UPDATE`/`DELETE` sur `points_ledger`, `leagues` ou `phases`).
- La migration s'applique à TEST puis à LIVE lors du publish.
