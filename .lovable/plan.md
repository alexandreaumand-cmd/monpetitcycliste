# Réduire la consommation de crédits (Lovable Cloud)

## Ce que montrent les mesures

Relevés faits à l'instant sur ce projet :

- **Base** : 2,52 Go, disque à 46 %, mémoire à 57 %, WAL 928 Mo.
- **Requêtes** : les vues de classement `v_manager_standings_by_season_v2` et `v_manager_standings_by_phase_v2` totalisent ~28 000 appels pour **~9,5 heures de temps CPU cumulé** (moyenne 0,8 à 1,3 s par appel, pics à 7,9 s). C'est de très loin le premier poste de charge serveur.
- **Écritures** : 1 195 561 mises à jour unitaires de `startlist_entries.team_confirmed` (une ligne à la fois).
- **Cron** : `live-broadcast-auto-scrape` tourne **toutes les minutes, 1 440 fois par jour, toute l'année** ; `auto-close-ghost-auctions`, `auto-open-scheduled-auctions` et `startlist-tracker-sync` toutes les 5 minutes ; `arena-pronostic-reminder` toutes les 15 minutes. Soit ~2 300 invocations de fonctions par jour hors usage utilisateur.
- **Historique sans purge** : `startlist_tracker_runs` 46 700 lignes (16 Mo), `user_activity_logs` 68 730 (19 Mo), `arena_messages` 29 242 (47 Mo), `notifications` 29 159 (17 Mo), `startlist_tracker_changes` 23 439.
- **Polling app** : rafraîchissements automatiques jusqu'à toutes les 3 s (annonces d'enchères), 5 s et 10 s (centre de contrôle des rounds).

## Actions proposées, par gain décroissant

### 1. Classements : arrêter de recalculer la même vue des dizaines de fois par page
Les appels observés montrent le même classement interrogé colonne par colonne et manager par manager (`total_points` seul, puis `manager_bonus`/`rider_bonus`, pour un `manager_id` à la fois). Chaque appel recalcule toute l'agrégation.
- Remplacer ces lectures répétées par **un seul appel** par écran, dont les composants enfants dérivent leurs valeurs.
- **Matérialiser** les classements saison et phase (table de cache rafraîchie quand les points changent, plutôt qu'à chaque lecture), et lire cette table côté app.
- Allonger le `staleTime` React Query sur les classements (aujourd'hui refetch fréquent) pour éviter les recalculs à chaque navigation.

Gain attendu : la majeure partie des ~9,5 h CPU cumulées, donc pression mémoire et latence en moins.

### 2. Ramener le scraping live à son besoin réel
- Ne déclencher `live-broadcast-auto-scrape` que **lorsqu'une course live est planifiée** : garder le cron mais sortir immédiatement avant toute connexion/travail, ou basculer le cron sur une plage horaire de course (par ex. 10h-19h) au lieu de 24h/24.
- Passer les crons enchères (`auto-close-ghost-auctions`, `auto-open-scheduled-auctions`) de 5 à 15 minutes hors périodes d'enchères actives.
- `startlist-tracker-sync` : passer de 5 minutes à 30 minutes (les startlists ne bougent pas au rythme de 5 min).

### 3. Grouper les écritures de startlist
Remplacer la boucle de 1,2 million d'`UPDATE` unitaires sur `startlist_entries` par des mises à jour groupées (un seul appel par lot d'identifiants). Moins d'écritures = moins de WAL (928 Mo aujourd'hui) et moins de charge.

### 4. Purge automatique des historiques
Ajouter un cron quotidien de rétention :
- `startlist_tracker_runs` : garder 30 jours.
- `user_activity_logs` : garder 90 jours.
- `notifications` : supprimer les lues de plus de 60 jours.
- `arena_messages` : archiver/supprimer les messages automatiques de live des saisons closes.
Puis `VACUUM`/`ANALYZE` pour rendre l'espace disque. Objectif : redescendre nettement sous 2,5 Go et contenir la croissance du disque.

### 5. Calmer le polling de l'interface
- Annonces d'enchères : 3 s → 10 s.
- Centre de contrôle des rounds : 5 s / 10 s → 20 s.
- Ajouter `refetchIntervalInBackground: false` partout (déjà fait sur le live) pour ne pas interroger le serveur onglet en arrière-plan.

### 6. Hygiène de publication (pas des crédits, mais du risque)
124 fonctions et 589 migrations, proches des seuils du rapport `publish-health`. Prévoir un passage de suppression des fonctions d'export/admin non utilisées.

## Détails techniques

- Cache des classements : nouvelle table `manager_standings_cache` (clés `league_id`, `saison_id`, `phase_id`, `manager_id`) alimentée par une fonction de rafraîchissement appelée après `compute-points` / saisie de résultats / bonus, plus un rafraîchissement complet nocturne de sécurité. Les vues actuelles restent la source de vérité pour le recalcul.
- Court-circuit du scraping : test `exists(select 1 from live_stage_plans where ...)` en tout début de handler, retour immédiat sinon.
- Retention : une fonction SQL `purge_old_data()` planifiée par `cron.schedule`, avec suppression par lots pour éviter les longues transactions.
- Aucun usage de l'AI Gateway détecté dans les fonctions : ce poste n'est pas à optimiser.

## Ce que je ne toucherai pas
Pas de changement de la logique de scoring, ni du parseur live, ni de la taille de l'instance : l'objectif est de réduire le travail inutile, pas de changer le comportement fonctionnel.
