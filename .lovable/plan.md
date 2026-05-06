## Contexte

La publication est cassée → impossible de passer par une migration normale (qui suit le flow Test → Publish → Live). Mais les optimisations proposées sont **100% du DDL non-bloquant** : tu peux les coller directement dans **Cloud → Run SQL** avec **Live sélectionné** et c'est appliqué immédiatement.

## Diagnostic résumé (mesuré sur Live à l'instant)

4 mini-tables se font scanner des dizaines de millions de fois :
- `leagues` (30 lignes) → **75 M seq_scan**, 1,25 Mds tuples lus
- `league_members` (99 lignes) → 22 M seq_scan
- `league_scopes` (30 lignes) → 31 M seq_scan
- `phases` (11 lignes) → 16 M seq_scan

**Cause racine** : les fonctions RLS `is_league_member` / `is_league_admin` / `is_superadmin` sont déclarées **VOLATILE** (par défaut). Postgres les ré-exécute à chaque ligne au lieu de les mettre en cache → explosion des scans dès qu'une RPC traite plusieurs ligues/managers.

## Script SQL à exécuter en Live

**Procédure** :
1. Cloud → Run SQL
2. Bascule sur **Live** (toggle en haut)
3. Colle le bloc ci-dessous
4. Run

Durée totale : ~30 secondes. Aucun lock bloquant. Entièrement réversible.

```sql
-- ============================================================
-- LEVIER 1 : Marquer les helpers RLS comme STABLE
-- (impact #1, c'est ce qui désature la base)
-- ============================================================
ALTER FUNCTION public.is_league_member(uuid)    STABLE PARALLEL SAFE;
ALTER FUNCTION public.is_league_admin(uuid)     STABLE PARALLEL SAFE;
ALTER FUNCTION public.is_superadmin()           STABLE PARALLEL SAFE;
ALTER FUNCTION public.has_role(uuid, app_role)  STABLE PARALLEL SAFE;

-- ============================================================
-- LEVIER 2 : Index manquants sur jointures fréquentes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_managers_user_id
  ON public.managers(user_id);

CREATE INDEX IF NOT EXISTS idx_managers_league_id
  ON public.managers(league_id);

CREATE INDEX IF NOT EXISTS idx_league_members_user_league_role
  ON public.league_members(user_id, league_id, role_in_league);

CREATE INDEX IF NOT EXISTS idx_phases_saison_id
  ON public.phases(saison_id);

CREATE INDEX IF NOT EXISTS idx_courses_phase_statut
  ON public.courses(phase_id, statut)
  WHERE phase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courses_date_fin
  ON public.courses(date_fin);

-- ============================================================
-- LEVIER 3 : Refresh des stats du planificateur
-- ============================================================
ANALYZE public.leagues;
ANALYZE public.league_members;
ANALYZE public.league_scopes;
ANALYZE public.phases;
ANALYZE public.managers;
ANALYZE public.courses;
ANALYZE public.points_ledger;
ANALYZE public.race_results;
ANALYZE public.rosters;

-- ============================================================
-- LEVIER 4 : Activer pg_stat_statements pour mesurer l'effet
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Reset des compteurs (optionnel, pour mesurer l'impact en clair)
SELECT pg_stat_reset();
```

## Vérification après exécution

15-30 minutes plus tard, lance ça toujours en Live pour confirmer :

```sql
-- Les seq_scan sur leagues/league_members/phases doivent être très faibles
SELECT relname, seq_scan, idx_scan, n_live_tup
FROM pg_stat_user_tables
WHERE relname IN ('leagues','league_members','league_scopes','phases','managers')
ORDER BY seq_scan DESC;

-- Top 10 RPC les plus coûteuses (pg_stat_statements actif maintenant)
SELECT calls, round(mean_exec_time::numeric, 1) AS mean_ms,
       round(total_exec_time::numeric, 0) AS total_ms,
       left(query, 120) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

## Ce qui se passe ensuite

- **Effet immédiat** : -60 à -80% de CPU DB. Le site redevient réactif, les bursts de charge passent sans saturer.
- **Publication** : une fois la DB désaturée, la publication remarchera (elle échoue probablement à cause des timeouts DB pendant le déploiement).
- **Cohérence Test/Live** : ces changements sont uniquement en Live. Quand la publication remarchera, je créerai la migration équivalente pour Test pour que les deux environnements soient alignés.

## Réversibilité

Si quoi que ce soit pose problème :

```sql
ALTER FUNCTION public.is_league_member(uuid)    VOLATILE;
ALTER FUNCTION public.is_league_admin(uuid)     VOLATILE;
ALTER FUNCTION public.is_superadmin()           VOLATILE;
ALTER FUNCTION public.has_role(uuid, app_role)  VOLATILE;

DROP INDEX IF EXISTS idx_managers_user_id;
DROP INDEX IF EXISTS idx_managers_league_id;
DROP INDEX IF EXISTS idx_league_members_user_league_role;
DROP INDEX IF EXISTS idx_phases_saison_id;
DROP INDEX IF EXISTS idx_courses_phase_statut;
DROP INDEX IF EXISTS idx_courses_date_fin;
```

## Risques

- **Aucun lock long** : les `CREATE INDEX` sur des tables de 30-500 lignes sont instantanés.
- **Aucun changement de comportement** : `STABLE` n'altère pas la sémantique des fonctions, juste leur cache au sein d'une requête.
- **Aucun risque sur les données** : pas de UPDATE/DELETE, uniquement du DDL et des stats.
