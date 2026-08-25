# Pourquoi « Palmarès & ligues » est lent — et comment le corriger

## Diagnostic (mesuré)

L'appel qui alimente ce bloc met **~5,4 s** côté base de données (mesure faite sur la fiche de Ludo dans CopaVuelta).

Le coupable est isolé : le calcul des **titres et podiums**. Il interroge la vue de classement saison pour **toutes les ligues terminées, tous les managers**, puis ne garde que les lignes du manager affiché. Mesure de cette seule partie : **~6,3 s et 6,4 millions de blocs lus** pour ne produire que 64 lignes utiles.

Cette vue est intrinsèquement coûteuse (plusieurs jointures complètes + résolution des courses de chaque ligue). Le reste du bloc (ligues créées/rejointes, coureur fétiche, coureur préféré) est rapide.

## Correction proposée

1. **Ne calculer les classements que sur les ligues concernées** : d'abord récupérer la liste des ligues terminées dont le manager est membre, puis calculer le rang uniquement sur ces ligues (au lieu de la totalité). C'est le gain principal.
2. **Réutiliser les fonctions rapides déjà en place** pour le classement par saison, plutôt que la vue lourde, lorsque c'est possible.
3. **Découper l'affichage** : les 4 compteurs de ligues et les 4 coureurs peuvent arriver ensemble une fois la requête rapide ; en cas de besoin, garder un squelette de chargement seulement sur la partie titres/podiums.
4. **Cache** : allonger la durée de fraîcheur côté client (ces stats bougent rarement), pour que le retour sur une fiche déjà visitée soit instantané.

Objectif : passer de ~5,4 s à moins de 0,5 s.

## Détails techniques

- `get_manager_extra_stats` : remplacer le CTE `ranked` (scan global de `v_manager_standings_by_season_v2` joint à `leagues` sur `status='completed'`) par un pré-filtrage sur les `league_id` issus de `league_members` pour le `user_id` du manager, et restreindre également par saison quand `_saison_id` est fourni.
- Vérifier avec `EXPLAIN (ANALYZE, BUFFERS)` avant/après.
- Côté front (`src/pages/ManagerProfile.tsx`) : `staleTime`/`gcTime` sur la query `mp-extra-stats`.
- Aucun changement de libellés ni de mise en page.
