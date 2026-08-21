# Accélérer la page « Équipes »

## Diagnostic (mesuré en base)

La lenteur ne vient pas du front mais des vues de classement `v_manager_standings_by_phase_v2` / `v_manager_standings_by_season_v2`, que la page Équipes interroge à chaque chargement (KPIs + rang du manager).

Mesures réelles :
- `select ... from v_manager_standings_by_phase_v2 where league_id = <ligue courante>` : **5,7 s**, 5,8 millions de blocs lus.
- Statistiques serveur : ces deux vues sont les requêtes les plus coûteuses du projet (moyenne 700 à 1000 ms, pointes à ~8 s, plusieurs milliers d'appels).

Cause technique confirmée par le plan d'exécution :
1. La vue commence par un bloc `WITH league_courses AS MATERIALIZED` qui calcule la liste des courses de **toutes les ligues** (15 ligues, appel de `get_league_course_ids` pour chacune), même quand on ne demande qu'une seule ligue.
2. Comme ce bloc est `MATERIALIZED` et que le filtre `league_id` est appliqué à la toute fin (après un `FULL JOIN` des 5 sous-agrégats), PostgreSQL ne peut pas « pousser » le filtre de ligue vers le bas : il calcule les points, scoreurs, bonus et victoires de tous les managers de toutes les ligues, puis jette 152 lignes sur 192.
3. Le coût grandit donc mécaniquement avec le nombre de ligues, de rosters et de résultats saisis — d'où la dégradation « depuis quelques jours » (nouvelles courses saisies + réécriture récente des vues pour la correction `started_at_effective`).

## Correction proposée

1. **Fonctions filtrées par ligue/phase** : créer `get_manager_standings_by_phase(_league_id, _phase_id)` et `get_manager_standings_by_season(_league_id, _saison_id)` (SQL, `STABLE`, `SECURITY INVOKER`) reprenant exactement la logique métier actuelle (y compris la comparaison inclusive `>=` sur `started_at_effective`), mais avec le filtre ligue/phase appliqué **dans chaque sous-agrégat** et `league_courses` restreint à la seule ligue demandée. Les vues existantes sont conservées telles quelles pour compatibilité.
2. **Index d'appui** si le plan le montre encore utile après réécriture : `points_ledger(course_id, coureur_id)`, `rosters(league_id, phase_id, coureur_id)`, `race_results(course_id, type_classement, etape_numero)`.
3. **Page Équipes** : remplacer l'appel `.from('v_manager_standings_by_phase_v2')` par l'appel RPC filtré, sur desktop et mobile, sans changer l'affichage ni les règles de calcul.
4. **Chargement en parallèle** : dans `loadTeam`, les appels séquentiels (session, manager, `manager-my-team`, standings, coureur bonus) sont lancés en parallèle quand ils sont indépendants, pour supprimer les allers-retours en cascade.
5. **Vérification** : `EXPLAIN (ANALYZE)` avant/après sur la ligue courante, contrôle que les points affichés restent identiques (ligue MPC 2026 et « suceurs de roux »), puis nouvelle lecture des requêtes lentes.

Objectif : passer de ~6 s à moins de 200 ms sur le chargement des KPIs, sans aucun changement de résultat affiché.

## Effet de bord attendu

Les pages Classement, Accueil et Statistiques utilisant les mêmes vues bénéficieront de la même optimisation dès qu'elles seront basculées sur les fonctions filtrées (étape suivante possible, hors périmètre immédiat si tu préfères limiter le risque).
