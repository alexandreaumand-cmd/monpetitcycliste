# Lien vers l'image de l'étape dans les pronostics « à venir »

## Objectif
Dans l'Arène > Pronostics, onglet « À venir », afficher un lien discret vers l'image du parcours de l'étape lorsqu'une image a été uploadée pour cette course/étape.

## Comportement
- Sur chaque carte de pronostic ouverte (onglet « À venir »), une petite ligne « Parcours de l'étape » avec une icône image apparaît **uniquement si une image existe**.
- Priorité de correspondance : image de l'étape exacte (`etape_numero`) ; sinon image générale de la course (`etape_numero` nul) pour les pronostics de type CG / course d'un jour.
- Clic → ouverture de l'image en grand dans une boîte de dialogue (avec le libellé de l'image), et un lien secondaire « Ouvrir dans un nouvel onglet ».
- Aucune ligne, aucun espace vide si aucune image n'est disponible.

## Détails techniques
- Source de données : table existante `course_route_images` (`course_id`, `etape_numero`, `image_url`, `label`) — même source que le panneau Live.
- Nouveau hook léger (dans `src/hooks/useArenaPronostics.ts` ou un petit hook dédié) qui charge les images de parcours pour la liste des courses affichées, avec cache (`staleTime` 5 min), afin d'éviter une requête par carte.
- `src/components/arena/PronosticRaceCard.tsx` : ajout de la ligne de lien + `Dialog` d'aperçu, affichée quand `!isExpired` et qu'une image correspond.
- Affichage via le composant existant `OptimizedImage`, tokens de couleur du thème uniquement.
- Traductions ajoutées dans `src/i18n/locales/fr/arena.json` et `en/arena.json` : `pronostics.routeImage`, `pronostics.routeImageOpen`.

Aucun changement de base de données ni de logique de calcul des pronostics.
