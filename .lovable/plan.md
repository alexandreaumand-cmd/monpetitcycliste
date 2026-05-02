# Classement à jour en auto et sans latence

## Diagnostic

J’ai mesuré la requête actuelle en LIVE sur MPC 2026 :

- `SELECT * FROM v_manager_standings_by_season_v2 WHERE league_id = 'MPC 2026'` met **~8,7 secondes**.
- Cause principale : la fonction `get_league_course_ids(league_id)` est marquée `VOLATILE` et appelée par PostgreSQL **ligne par ligne** dans un `Nested Loop Semi Join`. Le plan montre **1 046 239 lignes filtrées** rien que pour cette étape.
- Aggravé par le fait qu’on a transformé les anciennes vues matérialisées en **vues simples** pour corriger le bug de classement : chaque chargement recalcule tout depuis `points_ledger`, `race_results`, `rosters`, `manager_bonus_points`, `bonus_points`, etc., pour toute la ligue.
- Côté front, `get-performance-matrix` aggrave encore : il appelle la vue **N managers × M phases** fois en boucle.

Conclusion : la lenteur n’est pas un détail à indexer, c’est structurel. Recalculer le classement complet à chaque affichage ne tiendra pas.

## Solution proposée

Mettre en place un **cache de classement maintenu en temps réel** :

1. Une table `manager_standings_cache` qui stocke, par (`league_id`, `saison_id`, `phase_id`, `manager_id`), les colonnes du classement (points course, bonus manager, bonus rider, scoreurs, victoires, total).
2. Cette table est mise à jour **automatiquement** par des triggers sur les sources de vérité :
   - `points_ledger` (insert/update/delete)
   - `manager_bonus_points`
   - `bonus_points`
   - `race_results` (pour les victoires)
   - `rosters` (changement d’équipe)
   - `league_scopes` / `leagues` (changement de périmètre ligue)
3. Les triggers ne recalculent **que ce qui change** (la combinaison ligue + saison + phase + manager touchée), pas tout le classement.
4. Les vues `v_manager_standings_by_season_v2` et `v_manager_standings_by_phase_v2` sont réécrites pour **lire ce cache** au lieu de recalculer. Aucun changement côté front.
5. **Realtime** est activé sur `manager_standings_cache` pour que les pages classement et la matrice de performance se mettent à jour en direct, sans refresh.
6. Suppression du cron `refresh-standings-mv` devenu inutile, et de l’edge function `admin-refresh-standings`.

Bénéfices :
- Lecture du classement = simple `SELECT` indexé → **temps réel et sans latence** (millisecondes au lieu de secondes).
- Mise à jour **immédiate** dès qu’un point est ajouté ou corrigé (pas de délai cron).
- Cohérence garantie avec le détail manager (mêmes règles métier, juste pré-agrégées).
- Plus de vue matérialisée à rafraîchir, plus de cron fragile.

## Étapes de mise en œuvre

### Étape 1 — Optimisation immédiate (gain rapide, faible risque)
Avant de migrer vers le cache, marquer `get_league_course_ids` comme `STABLE` et ajouter quelques index manquants sur `points_ledger(course_id, coureur_id)`, `rosters(phase_id, coureur_id, league_id)`, `bonus_points(league_id, phase_id)`. Estimation : passage de 8,7 s à environ 1–2 s. Ça soulage tout de suite pendant qu’on prépare l’étape 2.

### Étape 2 — Création du cache de classement
- Création de la table `manager_standings_cache` avec contraintes et index par (`league_id`, `saison_id`, `phase_id`, `manager_id`).
- RLS : lecture autorisée aux membres de la ligue (mêmes règles que les vues actuelles).
- Fonction `recompute_manager_standings(league_id, saison_id, manager_id)` qui réutilise la logique métier déjà validée et écrit dans le cache.
- Initialisation : peuplement complet du cache pour toutes les ligues actives.

### Étape 3 — Triggers de mise à jour ciblée
Triggers `AFTER INSERT/UPDATE/DELETE` sur les tables sources, qui appellent `recompute_manager_standings` uniquement pour les `(league, saison, manager)` impactés. Pour éviter les rafales de recalculs (ex. import massif de résultats), debounce léger via une file d’attente `standings_recompute_queue` traitée immédiatement par défaut, mais regroupable.

### Étape 4 — Branchement des vues sur le cache
Réécriture de `v_manager_standings_by_season_v2` et `v_manager_standings_by_phase_v2` pour qu’elles lisent `manager_standings_cache`. **Aucun changement côté front, hooks ni edge functions** : le contrat reste identique.

### Étape 5 — Realtime + suppression du cron
- `ALTER PUBLICATION supabase_realtime ADD TABLE manager_standings_cache;`
- Ajout d’un hook `useRealtimeStandings` côté front sur les pages classement et matrice, pour invalider les queries React Query à chaque changement.
- Suppression du schedule `refresh-standings-mv` et de la function `admin-refresh-standings` (devenus inutiles).
- La page admin Cron Jobs reflète automatiquement la suppression.

### Étape 6 — Vérification LIVE MPC 2026
- Comparer total cache vs détail manager pour chaque manager → doit être strictement égal.
- Mesurer le temps de chargement du classement (objectif < 200 ms).
- Vérifier qu’une correction de point se propage en < 1 seconde dans l’UI sans refresh.

## Détails techniques

- Base concernée : Lovable Cloud (Test puis Live à la publication).
- Objets créés :
  - `public.manager_standings_cache` (table + RLS + index)
  - `public.recompute_manager_standings(uuid, uuid, uuid)` (fonction)
  - Triggers sur `points_ledger`, `manager_bonus_points`, `bonus_points`, `race_results`, `rosters`, `league_scopes`, `leagues`
- Objets modifiés :
  - `public.v_manager_standings_by_season_v2` (réécrite, contrat identique)
  - `public.v_manager_standings_by_phase_v2` (réécrite, contrat identique)
  - `public.get_league_course_ids` (marquée `STABLE`)
- Objets supprimés :
  - schedule `refresh-standings-mv`
  - edge function `admin-refresh-standings`
  - `public.refresh_standings_mv()` (no-op actuel)
- Front : ajout d’un hook `useRealtimeStandings` utilisé sur Rankings + matrice de performance. Aucun changement des hooks `useLeagueStandingsBySeason` / `useLeagueStandingsByPhase` / `useGlobalStandings`.
- Rétrocompatibilité : assurée tant qu’on ne supprime pas la fonction `refresh_standings_mv` avant de publier le code qui ne l’appelle plus.

## Résultat attendu

- Affichage du classement MPC 2026 en LIVE en **moins de 200 ms**.
- Mise à jour **automatique et immédiate** dès qu’un point change, sans refresh ni cron.
- Cohérence garantie entre le classement général et le détail manager.
- Plus aucun job planifié à surveiller pour les classements.
