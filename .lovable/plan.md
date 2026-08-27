# Live mobile : la « Situation » reste bloquée au retour dans l'app

## Cause

Deux mécanismes différents alimentent l'écran Live :

- **Timeline** : les messages ont, en plus du polling 30 s, un abonnement temps réel (`useArenaMessages`). Quand tu reviens sur l'app, la connexion se rétablit et les nouveaux évènements arrivent immédiatement.
- **Situation** : elle vient d'une requête simple sur `arena_live_courses` (`current_race_situation`) avec seulement `refetchInterval: 30 s`, sans temps réel. Sur mobile, l'onglet mis en arrière-plan gèle les timers (React Query ne rafraîchit pas en arrière-plan par défaut), et la configuration globale de l'app a `refetchOnWindowFocus: false`. Résultat : au retour, la Situation affiche encore la valeur d'avant la mise en veille (119,4 km) alors que la Timeline est à jour (106 km).

## Correctifs

Dans `src/components/arena/LiveCoursePanel.tsx`, pour la requête `arena-live-situation` :

1. Forcer un rafraîchissement au retour de l'app : `refetchOnWindowFocus: true` et écoute de `visibilitychange` (refetch dès que le document redevient visible).
2. `refetchOnMount: "always"` + `staleTime` abaissé (5 s) pour que le premier affichage ne serve pas une valeur périmée du cache.
3. `refetchIntervalInBackground: false` conservé (inutile de scraper en arrière-plan), le rattrapage se fait à la reprise de visibilité.
4. Sécurité d'affichage : si la situation affichée est plus « ancienne » que le dernier évènement de la Timeline (km restants supérieurs), afficher l'indicateur de fraîcheur en atténué pour signaler qu'un rafraîchissement est en cours plutôt qu'une donnée fausse.

Aucun changement de base de données, d'edge function ni de logique de scraping.
