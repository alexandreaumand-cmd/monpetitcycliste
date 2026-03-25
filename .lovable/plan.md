
Objectif
- Corriger le calcul des points pour que la ligue « à la course » ne compte que les courses réellement sélectionnées à la création (et pas toutes les courses de la/les phase(s)).

Constat actuel (code + backend)
- `league_scopes.selected_course_ids` existe, mais n’est pas utilisé dans le calcul des standings.
- `get_league_course_ids()` ne prend pas en compte `selected_course_ids`.
- Les vues `v_manager_standings_by_phase_v2`, `v_manager_standings_by_season_v2`, `v_manager_standings_total` et `v_manager_breakdown` agrègent via phase/roster, donc incluent des courses non sélectionnées.
- `get_previous_standings()` ne filtre pas non plus sur les courses autorisées de la ligue.

Plan d’implémentation
1) Rendre la sélection des courses “source de vérité”
- Migration SQL pour mettre à jour `public.get_league_course_ids(p_league_id uuid)` :
  - Si `selected_course_ids` est non vide, retourner strictement cette liste (intersectée avec `courses` existantes).
  - Sinon, conserver le comportement actuel (phases + filtres existants).

2) Refaire les vues de classement pour filtrer par courses autorisées
- Migration SQL pour recréer :
  - `v_manager_standings_by_phase_v2`
  - `v_manager_standings_by_season_v2`
  - `v_manager_standings_total`
  - `v_manager_breakdown`
- Dans chaque vue, filtrer les points via `get_league_course_ids(league_id)` (jointure/CTE dédiée) afin d’exclure toute course hors scope.

3) Aligner l’évolution de classement
- Migration SQL pour mettre à jour `get_previous_standings(...)` avec le même filtre de courses autorisées, pour que le badge d’évolution corresponde exactement aux standings affichés.

4) Vérification fonctionnelle ciblée
- Contrôles SQL sur la ligue concernée :
  - comparer `league_scopes.selected_course_ids` vs `course_id` effectivement présents dans `v_manager_breakdown`/standings.
  - vérifier qu’aucune course hors sélection n’alimente les points.
- Contrôle UI :
  - classement global, par saison, par phase
  - détail manager (breakdown)
  - évolution de rang

5) Correctif de données (si nécessaire)
- Pas de recalcul historique à persister : les vues se recalculent à la lecture.
- Si on détecte des ligues “à la course” sans `selected_course_ids` (legacy), faire une correction de données ciblée (opération data séparée), puis revérifier.

Détails techniques
- Fichiers impactés :
  - Nouvelle migration SQL (vues + fonctions SQL).
- Approche recommandée dans les vues :
  - CTE `eligible_courses` par ligue (basée sur `get_league_course_ids`) puis jointure sur `courses.id`.
  - Éviter d’appeler la fonction ligne par ligne pour limiter le coût.
- Effet attendu :
  - mêmes écrans, mêmes requêtes frontend, mais résultats enfin cohérents avec la configuration de la ligue.
