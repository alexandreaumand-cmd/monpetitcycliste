# Supprimer les données de live des courses terminées

## Constat (vérifié en base)
- Les messages de live (`admin_broadcast`) représentent 56 Mo, soit la plus grosse table de la base (2,2 Go au total).
- 38 415 messages de live existent, dont **37 080 appartiennent à des courses déjà finies** (date de fin passée). Seuls 1 335 concernent des courses à venir ou en cours.
- 31 plannings d'étapes sur 39 et 32 activations de live sur 37 concernent aussi des courses déjà finies.
- Les courses n'ont pas de champ « archivée » : le statut reste « programmée » même après la course. Le critère retenu est donc **la date de fin passée depuis plus de 3 jours** (marge pour laisser le temps de consulter le live juste après l'arrivée).

## Ce qui sera fait

1. **Nettoyage immédiat de l'historique**
   Suppression des messages de live, des plannings d'étapes et des activations de live pour toutes les courses finies depuis plus de 3 jours. Gain attendu : environ 50 Mo libérés tout de suite.

2. **Nettoyage automatique en continu**
   Une tâche quotidienne supprimera ces mêmes données dès qu'une course dépasse 3 jours après son arrivée. Plus besoin d'y penser.

3. **Ce qui est conservé**
   Les discussions des joueurs, les sondages, les pronostics, les résultats et les points ne sont jamais touchés. Seuls les messages générés automatiquement par le live et la configuration d'import liée à ces courses passées sont supprimés.

## Détails techniques
- Nouvelle fonction `public.purge_live_broadcast_data(p_grace_days int default 3)` (SECURITY DEFINER, `search_path = public`) :
  - `DELETE FROM arena_messages` où `message_type IN ('admin_broadcast','system')`, `author_manager_id IS NULL`, `course_id` d'une course dont `date_fin < current_date - p_grace_days`.
  - `DELETE FROM live_stage_plans` et `DELETE FROM arena_live_courses` pour ces mêmes courses.
  - Retourne le nombre de lignes supprimées par table (JSON) pour le suivi.
- Appel de cette fonction depuis `purge_old_app_data()` afin de réutiliser le cron de purge existant (sinon, ajout d'un job `pg_cron` quotidien dédié).
- Exécution unique de la fonction après la migration pour purger l'historique, suivie d'un `VACUUM (ANALYZE)` sur `arena_messages` pour rendre l'espace disque.
- Aucun changement côté application : les hooks du live (`useLiveCourses`, `useArenaMessages`, `useLiveStageStatus`) continuent de fonctionner à l'identique sur les courses en cours.
