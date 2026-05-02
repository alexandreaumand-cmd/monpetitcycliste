# Classement à jour, sans latence — solution finale

## Diagnostic

La requête `SELECT * FROM v_manager_standings_by_season_v2 WHERE league_id = ?` mettait **~9 secondes** en LIVE.
Cause : la fonction `get_league_course_ids(league_id)` était appelée par PostgreSQL **ligne par ligne** dans un nested loop semi join (1M+ lignes filtrées).

## Solution retenue (plus simple et plus performante que le cache + triggers)

1. **`get_league_course_ids` marquée STABLE** + ajout d'index sur `rosters(coureur_id, phase_id)`, `league_scopes(league_id, season_id)`, `race_results(course_id, type_classement, etape_numero) WHERE position=1 AND finished`.
2. **Création de deux fonctions SQL paramétrées** `get_league_standings_by_season(league_id, saison_id?)` et `get_league_standings_by_phase(league_id, phase_id?)` :
   - le filtre par ligue est appliqué **dès le départ** dans toutes les CTE,
   - retourne strictement les mêmes colonnes que les vues d'origine.
3. **Bascule des hooks principaux** vers les RPC :
   - `useLeagueStandingsBySeason` / `useLeagueStandingsByPhase`
   - `useSeasonRankings` / `usePhaseRankings`
4. Les vues `v_manager_standings_by_season_v2` et `v_manager_standings_by_phase_v2` sont conservées (réécrites avec une CTE matérialisée), pour les autres usages secondaires qui filtrent par `manager_id`.

## Résultat attendu en LIVE après publication

- Classement complet d'une ligue : **<200 ms** (vs ~9 s).
- Mise à jour automatique : à chaque invalidation React Query (déjà déclenchée sur les mutations) → données fraîches sans cron.
- Cohérence garantie : mêmes règles métier que les vues d'origine, vérifiée en Test (totaux strictement identiques).

## Étape suivante (à valider après publication)

Si la latence ressentie n'est toujours pas satisfaisante, on pourra ajouter :
- Realtime sur `points_ledger` pour invalider automatiquement les classements.
- Bascule des hooks secondaires (`useLeagueCardsData`, `useMyLeagueStats`, edge functions).
