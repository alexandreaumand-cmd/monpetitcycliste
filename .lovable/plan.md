# « Oups, une erreur est survenue » à l'ouverture de l'appli

## Ce qui se passe

Le message exact — « Failed to fetch dynamically imported module: .../assets/Dashboard-B4Cznoex.js » — veut dire que le téléphone essaie de charger un morceau de l'appli qui n'existe plus sur le serveur.

Pourquoi : la page d'accueil de l'appli est gardée en mémoire par le navigateur pendant 1 heure (et bien plus longtemps encore quand l'appli est installée sur l'écran d'accueil). Chaque fois que vous publiez une nouvelle version, les fichiers de pages reçoivent un nouveau nom et les anciens disparaissent. L'utilisateur qui ouvre l'appli avec l'ancienne page en mémoire demande donc un fichier supprimé : les pages étant chargées à la demande, l'écran d'erreur remplace tout l'écran. Comme vous publiez souvent en ce moment, il le voit souvent. Le bouton « Recharger la page » marche parfois seulement, car la page d'accueil en mémoire est resservie telle quelle.

## Correctifs

1. **Ne plus garder la page d'accueil en mémoire** : dans `public/_headers`, servir le document HTML en `no-cache` (revalidation à chaque ouverture) tout en gardant les fichiers `/assets/*` en cache long. L'utilisateur reçoit alors toujours la liste à jour des fichiers de pages.

2. **Se rattraper automatiquement quand un fichier manque** : un petit utilitaire de chargement de page (`src/lib/lazyWithRetry.ts`) qui, en cas d'échec de chargement, réessaie une fois, puis recharge l'appli une seule fois (drapeau posé dans `sessionStorage` pour éviter toute boucle). Toutes les pages chargées à la demande dans `src/App.tsx` passent par cet utilitaire.

3. **Message plus doux en dernier recours** : dans `src/components/shared/ErrorBoundary.tsx`, reconnaître ce type d'erreur (« Failed to fetch dynamically imported module », « Importing a module script failed ») et afficher « Une nouvelle version est disponible » avec un bouton de rechargement forcé, au lieu de l'écran d'erreur rouge générique.

## Détails techniques

- `public/_headers` : ajouter une règle `/index.html` + `/` en `Cache-Control: no-cache` ; conserver `immutable` sur `/assets/*`.
- `lazyWithRetry(importFn)` : `React.lazy` enveloppé, `catch` → un retry immédiat, puis `sessionStorage.setItem('chunk-reload', ...)` + `window.location.reload()` si pas déjà tenté ; le drapeau est effacé au chargement réussi.
- Aucune modification du SDK LaunchKit dans `src/main.tsx`, aucun changement de base de données, aucun service worker d'application ajouté (le worker de notifications `sw-push.js` reste intact et ne met rien en cache).
