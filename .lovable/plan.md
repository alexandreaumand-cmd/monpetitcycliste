# Accélérer l'ouverture d'une course dans la page Startlist

## Ce qui se passe

Quand vous cliquez sur une course, l'application appelle la fonction backend qui construit la vue « managers ». Cette fonction interroge deux vues de classement (par phase et par saison). Mesure faite sur la base : la vue de classement par phase met **plus de 6 secondes** à répondre à elle seule. C'est la cause principale de la latence.

Ces vues lentes ont déjà été remplacées ailleurs (page Équipes, fiche Manager) par deux fonctions rapides équivalentes, `get_manager_standings_by_phase` et `get_manager_standings_by_season`, qui existent bien en base. La page Startlist est restée sur les anciennes vues.

## Corrections prévues

1. **Classements** : dans la fonction `startlist-manager-view`, remplacer les lectures des vues `v_manager_standings_by_phase_v2` / `v_manager_standings_by_season_v2` par les appels RPC rapides `get_manager_standings_by_phase(_league_id, _phase_id)` et `get_manager_standings_by_season(_league_id, _saison_id)`. Le tri et le calcul des rangs/écarts restent identiques.

2. **Points récents (5 dernières semaines)** : aujourd'hui la fonction charge tous les points de tous les coureurs de la startlist, puis va chercher les dates des courses pour ne garder que 5 semaines. On inversera l'ordre : d'abord la liste des courses dont `date_fin` est dans les 5 dernières semaines, puis les points limités à ces courses. Moins de données transférées, même résultat affiché.

3. **Parallélisation** : les blocs indépendants de la fonction (classements, notes/ratings, sponsors, images de parcours, barème) seront exécutés en parallèle plutôt qu'en séquence.

4. **Côté page** :
   - Supprimer l'aller-retour supplémentaire vers `startlist_imports` (validation PCS et métadonnées) qui s'enchaîne après la fonction : ces champs seront renvoyés directement par la fonction, ou lus en parallèle et non plus en cascade.
   - Ajouter un `staleTime` (quelques minutes) sur les requêtes `startlist-view`, `startlist-entries` et la liste des startlists, pour qu'un retour sur une course déjà consultée soit instantané.
   - Précharger (`prefetchQuery`) la vue de la course au survol de sa carte, afin que le clic paraisse immédiat.

## Vérification

Comparer le temps de réponse de la fonction avant/après sur une course chargée (Tour de France) et vérifier que les données affichées (managers, rangs, écarts, étoiles, coureurs, forme sur 5 semaines) sont inchangées.

## Détails techniques

- Fichiers touchés : `supabase/functions/startlist-manager-view/index.ts`, `src/pages/Startlist.desktop.tsx`, `src/pages/Startlist.mobile.tsx`.
- Aucune modification de schéma ni de migration nécessaire : les fonctions SQL rapides existent déjà.
- Les vues `v_manager_standings_*_v2` restent en place (encore utilisées ailleurs) ; leur optimisation propre n'est pas dans le périmètre de cette correction.
