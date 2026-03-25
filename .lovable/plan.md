
Objectif
- Corriger l’affichage des points dans « Ligue Flandriennes 2026 » pour que seules les courses autorisées de la ligue (et après démarrage effectif) comptent partout, y compris sur l’écran Équipe.

Diagnostic confirmé
- La ligue a bien un scope “à la course” (5 courses sélectionnées) et `started_at_effective = 2026-03-26`.
- Les points affichés viennent de **Volta Ciclista a Catalunya (2026-03-23)**, donc :
  - hors `selected_course_ids`
  - avant `started_at_effective`
- Les vues de classement corrigées (`v_manager_standings_*`) renvoient déjà 0 pour cette ligue.
- Le problème vient surtout de la RPC `manager_team_by_id` (utilisée par `manager-my-team`) qui additionne encore les points de toute la phase.

Plan d’implémentation
1) Corriger la source des points “Mon Équipe” côté SQL (migration)
- Mettre à jour `public.manager_team_by_id(...)` pour filtrer les points par :
  - `get_league_course_ids(p_league_id)` quand une ligue est fournie
  - `courses.date_debut >= leagues.started_at_effective` (si non null)
- Appliquer ce filtre dans :
  - CTE `points` (points course)
  - CTE `rider_bonus` si besoin de cohérence par course (quand `coureur_id` + course liée)
- Conserver le fallback legacy quand `p_league_id IS NULL`.

2) Aligner les KPIs de `manager-my-team` avec les mêmes règles
- Dans `supabase/functions/manager-my-team/index.ts`, appliquer le même périmètre de courses autorisées pour :
  - `total_race_days`
  - `wins_count`
- Ne plus laisser des métriques “phase complète” fuiter dans les ligues “à la course”.

3) Sécuriser l’affichage frontend pour éviter les incohérences
- `src/components/team/MyTeam.desktop.tsx` :
  - corriger la requête standings (`bonus_points` n’existe pas sur `v_manager_standings_by_phase_v2`; utiliser `manager_bonus` + `rider_bonus`)
  - fallback explicite à 0 si aucune ligne standings.
- Vérifier que mobile/desktop affichent la même logique.

4) Vérification ciblée sur « Ligue Flandriennes 2026 »
- SQL de contrôle :
  - comparer sorties `manager_team_by_id` avant/après
  - vérifier qu’aucun point ne provient d’une course hors `selected_course_ids`
  - vérifier exclusion des courses `< started_at_effective`
- UI :
  - Dashboard Home + Mon Équipe (desktop/mobile) : points/jours/victoires à 0 avant la 1re course sélectionnée
  - Après arrivée de résultats sur une course sélectionnée : les points apparaissent normalement.

Détails techniques
- Fichiers impactés :
  - nouvelle migration SQL (update `manager_team_by_id`)
  - `supabase/functions/manager-my-team/index.ts`
  - `src/components/team/MyTeam.desktop.tsx`
- Aucun backfill nécessaire : calculs dynamiques à la lecture, donc correction immédiate après déploiement.
