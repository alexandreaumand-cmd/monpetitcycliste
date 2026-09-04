# Repère de progression sur le profil d'étape (Live)

## Objectif
Sur l'écran Live d'une ligue, quand une image de profil d'étape est disponible, afficher un repère qui montre où en est la course, calculé à partir des « km restants » de la situation de course. Le repère se met à jour à chaque nouvelle mise à jour du live.

## Ce que l'utilisateur verra
- Une ligne verticale colorée sur le profil, à la position correspondant à l'avancée de la course.
- La partie déjà parcourue (à gauche de la ligne) légèrement grisée.
- Une petite étiquette sur la ligne : « 106 km restants ».
- Le même repère dans la vue agrandie du profil (il suit le zoom et le déplacement).
- Si aucune situation de course n'est disponible, aucun repère n'est affiché (le profil reste inchangé).

## Distance totale de l'étape
La position se calcule avec `parcouru = distance totale − km restants`.
- Champ « Distance (km) » saisi manuellement par étape, dans la partie super-admin où sont gérées les images de parcours. C'est la valeur de référence.
- À défaut de saisie, on utilise automatiquement la plus grande valeur de « km restants » observée depuis le début de l'étape comme estimation de la distance totale, et l'étiquette reste correcte.
- Si aucune des deux n'est exploitable (km restants > distance), le repère n'est pas affiché.

## Calage
La ligne est calée sur toute la largeur de l'image (0 % = départ, 100 % = arrivée), conformément au choix retenu. Pas de réglage par image.

## Détails techniques
- Base : ajouter une colonne `distance_km numeric null` à `course_route_images` (migration + GRANT inchangés, RLS existante conservée). Saisie exposée dans l'écran super-admin de gestion des images de parcours.
- Nouveau composant `src/components/arena/StageProgressOverlay.tsx` : conteneur `relative` autour de l'image, overlay `absolute` en pourcentage (voile `bg-foreground/15` sur la portion parcourue + ligne 2 px en `bg-primary` + badge). Aucune couleur codée en dur hors tokens.
- `src/components/arena/LiveCoursesTab.tsx` : `latestSituation.kmRemaining` est déjà calculé pour la situation ; le passer à l'overlay dans les deux blocs Profil (desktop et mobile), avec `distance_km` récupérée via la requête `course-route-images` existante.
- Distance de repli : calculer le max des `kmRemaining` présents dans les messages de l'étape sélectionnée (`filteredMessages`), déjà en mémoire — aucun appel réseau supplémentaire.
- `src/components/arena/StageProfileZoomDialog.tsx` : accepter `kmRemaining` / `totalKm` optionnels et rendre l'overlay dans le même conteneur transformé que l'image, afin qu'il reste aligné pendant zoom et déplacement.
- Mise à jour temps réel : aucune logique nouvelle — l'overlay dérive de la situation déjà rafraîchie par le polling / `visibilitychange` existant.
