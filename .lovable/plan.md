# Plan — Respect strict du scope de courses (ligues `per_course`)

## Problème

Pour les ligues en mode "À la course" (ex. **COPArdennaises**, scope = Amstel + Flèche Wallonne + Liège-Bastogne-Liège), 4 zones de l'app affichent encore des données issues de courses **hors scope** (Ronde van Vlaanderen, Itzulia, Paris-Roubaix, etc.).

Cause racine : ces 4 vues filtrent uniquement par **phase** (ou pas du tout par ligue), sans appliquer le filtre `league_scopes.selected_course_ids`. Le RPC `get_league_course_ids(p_league_id)` existe déjà et est utilisé ailleurs (ex. `get-rider-points-table`) — il faut l'étendre aux 4 endpoints fautifs.

## Captures → fichiers concernés

| Capture | Symptôme | Fichier à corriger |
|---|---|---|
| 1 | 2 icônes Monuments (Ronde van Vlaanderen hors scope) | `supabase/functions/get-manager-prestige-wins/index.ts` |
| 2 | Bonus de Paul Seixas affiché ; sur mobile, points de courses hors scope dans le détail coureur | `supabase/functions/get-rider-points-table/index.ts` (bonus) + `supabase/functions/manager-coureur-points-detail/index.ts` (mobile) |
| 3 | Onglets "La Chatte", "Équipes", "Catégories" listent des courses hors scope | `supabase/functions/get-luck-ranking/index.ts` + `supabase/functions/get-team-category-stats/index.ts` |
| 4 | Pronostics affichent des courses hors scope (Tour de Turkiye…) | `src/hooks/useArenaPronostics.ts` (`usePronosticDeadlines`) |

## Corrections détaillées

### 1. Prestige (Capture 1) — `get-manager-prestige-wins`
- Lire `selected_course_ids` via le RPC `get_league_course_ids(league_id)` quand `league_id` est fourni.
- Si présent, intersecter avec `prestigeCourses` avant la requête `race_results`.
- Effet : Paul Seixas n'aura que Liège-Bastogne-Liège comme Monument dans COPArdennaises (1 icône au lieu de 2).

### 2a. Détail coureur — bonus (Capture 2 desktop) — `get-rider-points-table`
- Le filtrage par `course_id` est déjà fait pour `points_ledger`, mais **pas pour les bonus** (commentaire ligne 235 : "No league course filter on bonuses").
- Correction : si `leagueCourseIds` est défini, filtrer `bonus_points` sur `course_id IN leagueCourseIds` **OU** `course_id IS NULL` (bonus globaux type "Bonus +25%" doivent rester).
- Effet : le bonus "Flèche Wallonne / Liège" reste, le bonus lié à une autre course disparaît.

### 2b. Détail coureur mobile (Capture 2 mobile) — `manager-coureur-points-detail`
- L'edge function appelle aujourd'hui le RPC `manager_coureur_points_detail(coureur_id, phase_id)` sans connaissance de la ligue → tous les points de la phase remontent.
- Correction : ajouter le paramètre optionnel `league_id` dans le payload, récupérer `selected_course_ids` via `get_league_course_ids`, puis filtrer côté JS le tableau renvoyé par le RPC sur `course_id IN scope` (en complément du filtre par phase).
- Côté front : ajouter `league_id` à l'appel `supabase.functions.invoke('manager-coureur-points-detail', …)` (vérifier les hooks/composants appelants).

### 3a. La Chatte (Capture 3) — `get-luck-ranking`
- Aujourd'hui : filtre uniquement par `phase_id` issu de `league_scopes.phases`. Pour les ligues `per_course`, toutes les courses des phases concernées remontent.
- Correction : récupérer aussi `selected_course_ids` via `get_league_course_ids(league_id)`. Si non vide, ajouter `.in('course_id', scopeIds)` à la requête `points_ledger` paginée.
- Effet : le breakdown ("Top courses détail", "Gros coups") ne contient que les 3 courses du scope.

### 3b. Onglets Équipes & Catégories — `get-team-category-stats`
- Même problème : agrégation de `points_ledger` filtrée uniquement par `activePhaseIds`.
- Correction identique : si `league_id` fourni, charger `selected_course_ids` et filtrer la pagination de `points_ledger` sur `course_id IN scope`.

### 4. Pronostics Arène (Capture 4) — `usePronosticDeadlines`
- Aujourd'hui : `SELECT * FROM arena_pronostic_deadlines` sans filtre.
- Correction : passer `leagueId` au hook ; charger les `selected_course_ids` de la ligue (réutiliser la query `league-scope-courses` déjà cachée par `useLeagueFilteredRaces`) ; filtrer le résultat sur `course_id IN scope` (uniquement quand le scope est défini — ligues 5-phases sans scope listé ne sont pas impactées).
- Mettre à jour les appelants (`PronosticsTab.tsx`) pour passer `leagueId`. Les hooks `useEvaluatedDeadlineIds`, etc. travaillent déjà à partir de `deadlines`, donc cascade automatique.

## Notes techniques

- Toutes les modifications réutilisent `get_league_course_ids` (déjà déployé) → cohérence et cache PostgreSQL.
- Pas de migration SQL nécessaire ; uniquement code edge functions + 1 hook front.
- Aucun impact sur les ligues "5 phases" sans scope course explicite (`selected_course_ids` vide → filtre désactivé).
- Invalider les query keys après déploiement (`manager-prestige-wins`, `rider-points-table`, `team-category-stats`, `luck-ranking`, `arena-pronostic-deadlines`) — automatique via clé `leagueId`.

## Tests de non-régression

1. **COPArdennaises (LIVE)** : 1 icône Monument pour Sixela, pas de bonus hors scope, La Chatte limitée à 3 courses, Pronostics ne montre que les 3 courses.
2. **Ligues 5-phases standard** : aucun changement (scope non défini → filtre passthrough).
3. **Ligues `per_course` avec courses futures** : pronostics futurs des courses du scope visibles.
