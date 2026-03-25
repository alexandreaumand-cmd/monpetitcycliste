
Objectif
- Corriger l’affichage de l’onglet **Mon Équipe** pour que la ligue **Flandriennes 2026** affiche bien **0 point** (et éviter toute réapparition de “points fantômes” dans les classements).

Constat confirmé
- En base, pour cette ligue, `manager_team_by_id(...)` renvoie bien les coureurs à **0 pt**.
- Mais `v_manager_standings_by_phase_v2` renvoie `rider_bonus = 50` et `total_points = 50`.
- Cause: dans `v_manager_standings_by_phase_v2` (et sa version saison), la CTE `rider_bonus_pts` agrège `bonus_points` **sans filtrage de scope/date** pour les bonus coureur.
- Dans le front (`MyTeam.desktop.tsx` / `MyTeam.mobile.tsx`), les KPIs sont ensuite écrasés par la vue standings, d’où le total 50 visible.

Plan de correction

1) Migration SQL (source unique de vérité)
- Créer une migration qui recrée:
  - `public.v_manager_standings_by_phase_v2`
  - `public.v_manager_standings_by_season_v2`
- Ajouter un filtrage strict dans `rider_bonus_pts`:
  - Pour `bonus_type = 'coureur_bonuse'`:
    - `course_id` obligatoire
    - `course_id` dans `get_league_course_ids(league_id)`
    - `courses.date_debut >= COALESCE(leagues.started_at_effective, leagues.created_at)::date`
  - Conserver les autres bonus non liés course si nécessaire (comportement actuel).
- Résultat attendu SQL: le bonus rétroactif lié à `volta-ciclista-a-catalunya-...` ne compte plus pour Flandriennes 2026.

2) Harmonisation front (anti-désynchronisation)
- `src/components/team/MyTeam.desktop.tsx`
- `src/components/team/MyTeam.mobile.tsx`
- Ne plus écraser `kpis.total_points` avec `standing.total_points` quand la valeur déjà calculée par `manager-my-team` est disponible.
- Conserver la vue standings pour ce qui est “classement/rang” si besoin, mais éviter d’introduire une divergence “table coureurs = 0” vs “KPI total = 50”.

3) Vérifications ciblées (TEST)
- Ligue `eaf6d86f-2a7a-40d0-a6ca-4093c381e479`:
  - `v_manager_standings_by_phase_v2` pour le manager concerné -> `total_points = 0`, `rider_bonus = 0`.
  - `/dashboard/mon-equipe?leagueId=...`:
    - KPI “Total pts” = 0
    - lignes coureurs = 0
- Non-régression:
  - Ligues “à la phase” classiques conservent leurs points.
  - Onglet Classement reste cohérent avec Mon Équipe.

Détails techniques
- Fichiers à modifier:
  - `supabase/migrations/<new_timestamp>_fix_standings_rider_bonus_scope.sql`
  - `src/components/team/MyTeam.desktop.tsx`
  - `src/components/team/MyTeam.mobile.tsx`
- Principe clé:
  - Les bonus coureur (`coureur_bonuse`) doivent suivre exactement la même logique de scope/date que les points de course dans les vues de standings.
