## Problème identifié

Le classement général de la ligue **MPC 2026** (LIVE) est désynchronisé alors que les détails par manager sont corrects.

Exemple pour Fab :
- Détail complet (vue `v_manager_breakdown`) : **19 246 pts** de course (cohérent avec ce que tu vois à l'écran : 19 221 pts course + bonus)
- Classement (vue `v_manager_standings_by_season_v2`) : **18 826 pts**, soit **445 pts manquants**

### Cause racine

Les "vues" du classement (`v_manager_standings_by_season_v2`, `v_manager_standings_by_phase_v2`, `v_manager_standings_total`) sont en réalité des **vues matérialisées** (matviews). Elles stockent un instantané des données et ne se mettent à jour qu'à l'exécution explicite de `REFRESH MATERIALIZED VIEW`.

Vérifications faites :
- Une fonction `refresh_standings_mv()` existe bien et fait le bon boulot.
- **Aucun trigger** sur `points_ledger` / `race_results` / `bonus_points` ne l'appelle.
- **Aucun job cron** ne l'appelle non plus.

Conséquence : depuis le dernier refresh manuel, tous les nouveaux points ingérés (résultats de courses récentes, bonus, etc.) sont visibles dans les vues "live" (`v_manager_breakdown`, calculs unitaires) mais pas dans la matview du classement.

### Plan de correction

1. **Refresh immédiat** des trois matviews via `SELECT public.refresh_standings_mv();` (corrige le classement de MPC 2026 et de toutes les autres ligues).
2. **Mettre en place un refresh automatique** pour que ça ne se reproduise plus. Option retenue : un **job cron pg_cron** qui appelle `refresh_standings_mv()` toutes les **2 minutes**.
   - C'est le pattern le plus simple, déjà utilisé dans le projet pour d'autres traitements.
   - Les matviews utilisent `CONCURRENTLY` donc le refresh ne bloque pas les lectures.
   - 2 minutes = compromis entre fraîcheur perçue (acceptable pour un classement) et charge DB.
3. **Vérification post-refresh** : reconfirmer en LIVE que `v_manager_standings_by_season_v2` retourne bien 19 246 pts course pour Fab.

### Détails techniques

```sql
-- 1. Refresh ponctuel
SELECT public.refresh_standings_mv();

-- 2. Cron toutes les 2 minutes
SELECT cron.schedule(
  'refresh-standings-mv',
  '*/2 * * * *',
  $$ SELECT public.refresh_standings_mv(); $$
);
```

Aucun changement côté frontend nécessaire — les hooks `useLeagueStandingsBySeason`, `useGlobalStandings` etc. continueront à lire ces matviews, mais avec des données fraîches.

### Points à confirmer avant exécution

- OK pour le **rythme de 2 minutes** ? (alternatives : 1 min plus réactif mais plus de charge ; 5 min plus économe mais perceptible par les utilisateurs)
- OK pour appliquer le refresh immédiat **directement en LIVE** (le cron sera créé via migration et donc poussé en LIVE à la prochaine publication du projet) ?
