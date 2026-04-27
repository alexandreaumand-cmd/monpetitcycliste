# Plan d'action — Lenteurs LIVE (dashboard & classement)

## Diagnostic

J'ai mesuré directement la base LIVE pour comprendre les lenteurs.

**Cause racine identifiée** : la vue `v_manager_standings_by_season_v2` (et ses cousines `_by_phase_v2`, `_total`) est une **vue SQL standard, pas une vue matérialisée**, contrairement à ce que l'on pensait. Chaque appel recalcule tout depuis zéro :

- 5 CTE qui scannent `points_ledger`, `race_results`, `bonus_points` + jointures sur `rosters`, `phases`, `courses`
- La fonction `get_league_course_ids()` est appelée comme sous-requête (ré-exécutée pour chaque ligne)
- **Mesure réelle** : `SELECT * FROM v_manager_standings_by_season_v2 WHERE league_id = '…'` → **9,03 secondes**, **1 068 945 buffers lus (~8 Go de mémoire tampon)** pour retourner 10 lignes.

Cette vue est appelée à plusieurs endroits sur les écrans incriminés :

| Écran | Hook / composant | Appels à la vue |
|---|---|---|
| Dashboard (cartes ligues) | `useLeagueCardsData` | 1 fois (toutes ligues actives) |
| Dashboard (mes stats) | `useMyLeagueStats` | 1 fois par ligue affichée |
| Classement desktop | `ManagerStandings` | 2 fois (`_by_season_v2` + `_by_phase_v2`) |
| Classement mobile | `Rankings.mobile` | 3 fois (`_by_season_v2` + `_by_phase_v2` + `_total`) |
| Mon Équipe | `MyTeam.desktop/mobile` | 1 à 2 fois |
| Comparaison managers | `ManagerComparison` | 1 fois |

Sur un dashboard avec 2-3 ligues, on déclenche facilement **5 à 8 recalculs complets en parallèle** = 10 à 30 secondes perçues, avec en plus l'ENV LIVE qui sature CPU/RAM côté backend.

Symptômes secondaires observés : `pg_stat_statements` n'est pas activé (impossible de profiler en prod), aucune vue matérialisée n'existe en base, et les CTE de la vue parcourent tout `points_ledger` même quand on filtre sur une seule ligue.

## Plan d'action

### 1. Convertir les 3 vues de classement en vues matérialisées

Remplacer `v_manager_standings_by_season_v2`, `v_manager_standings_by_phase_v2` et `v_manager_standings_total` par des **MATERIALIZED VIEW** avec index sur `(league_id, saison_id)` / `(league_id, phase_id)`.

Effet attendu : passer de **~9 s à <50 ms** par lecture (lecture indexée d'une table pré-calculée).

### 2. Mettre en place le rafraîchissement automatique

Trigger les rafraîchissements (`REFRESH MATERIALIZED VIEW CONCURRENTLY …`) uniquement quand les données sources changent réellement :

- À la **publication d'annonces** (fin d'un round d'enchères) → modifie les rosters
- À l'**import de résultats de course** / recalcul de points → modifie `points_ledger`, `bonus_points`
- À l'**ajout de bonus** par le super-admin

Implémentation via une fonction `refresh_standings_mv(league_id uuid)` appelée explicitement depuis les Edge Functions concernées (`publish-announcements`, `recalc-points`, `super-admin-bonus`…), plus un cron de sécurité toutes les 15 min.

### 3. Ajouter un index unique sur chaque MV pour autoriser `REFRESH … CONCURRENTLY`

Permet de rafraîchir sans bloquer les lectures.

### 4. Activer `pg_stat_statements` en LIVE

Pour pouvoir mesurer en continu les requêtes lentes et détecter d'autres régressions à venir.

### 5. Instrumenter le hook `useLeagueCardsData`

Ajouter un fallback : si le `REFRESH` est en cours et que la MV ne contient pas encore de ligne pour la ligue, retomber proprement sur l'état "Calcul en cours…" déjà en place (corrigé la semaine dernière).

### 6. Vérification

Après déploiement, re-mesurer sur 3 cas typiques (1 ligue, 3 ligues, page classement complète) avec `EXPLAIN ANALYZE` et vérifier que les temps passent sous **200 ms côté DB**.

## Détails techniques

```sql
-- Exemple pour la vue saison
CREATE MATERIALIZED VIEW public.mv_manager_standings_by_season_v2 AS
  <même requête que la vue actuelle>;

CREATE UNIQUE INDEX mv_standings_season_pk
  ON public.mv_manager_standings_by_season_v2 (manager_id, league_id, saison_id);
CREATE INDEX mv_standings_season_league
  ON public.mv_manager_standings_by_season_v2 (league_id, saison_id);

-- On garde le nom v_… via une vue passe-plat pour ne pas casser le code TypeScript
DROP VIEW public.v_manager_standings_by_season_v2;
CREATE VIEW public.v_manager_standings_by_season_v2
  WITH (security_invoker = on)
  AS SELECT * FROM public.mv_manager_standings_by_season_v2;
```

```sql
CREATE OR REPLACE FUNCTION public.refresh_standings_mv()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_manager_standings_by_season_v2;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_manager_standings_by_phase_v2;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_manager_standings_total;
END $$;
```

**Edge Functions à modifier** : `publish-announcements`, `recalc-course-points`, `super-admin-bonus-attribute` → ajouter `await supabase.rpc('refresh_standings_mv')` en fin de traitement.

**Cron de sécurité** : `select cron.schedule('refresh-standings', '*/15 * * * *', $$select public.refresh_standings_mv();$$);`

**Note de mémoire** : la mémoire `mem://technical/database/standings-materialized-views-performance` indiquait à tort que ces vues étaient déjà matérialisées. Je la corrigerai après implémentation.

## Fichiers / objets impactés

- Migration SQL : création des 3 MV + indexes + fonction refresh + cron
- `supabase/functions/publish-announcements/index.ts` (ajout RPC refresh)
- `supabase/functions/recalc-*` / fonctions de calcul de points (ajout RPC refresh)
- Aucun changement frontend nécessaire (les noms `v_…` restent identiques via vues passe-plat)

## Bénéfice attendu

- Dashboard : chargement des cartes de **5-15 s → <1 s**
- Page classement : **8-20 s → <500 ms**
- Réduction massive de la charge CPU/RAM côté Lovable Cloud (utile aussi pour les autres écrans)
