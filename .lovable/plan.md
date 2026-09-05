# Pourquoi le repère tombe au mauvais endroit sur l'étape 14

## La cause, vérifiée

Pour l'étape 14 de la Vuelta, les deux poignées (départ / arrivée) sont bien posées sur l'image, mais **la distance de l'étape n'est pas renseignée** (elle est vide en base ; seule l'étape 13 a 192,8 km d'enregistré).

Faute de distance, l'app se rabat sur une estimation : le plus grand « km restants » vu depuis le début du suivi (ici environ 70 km, car le suivi a démarré en cours d'étape). Le calcul devient donc « 70 − 11,9 » au lieu de « 154,5 − 11,9 », et le repère se retrouve trop à gauche, vers 123 km, au lieu de 142,6 km.

## Ce qui change

1. **Saisir la distance des étapes concernées.** C'est le geste qui corrige immédiatement l'affichage : 154,5 km pour l'étape 14 (et les autres étapes de la Vuelta déjà calées mais sans distance).
2. **Ne plus afficher un repère faux.** Quand la distance n'est pas renseignée, le repère est masqué plutôt que placé sur une estimation trompeuse. Un petit message dans l'écran d'administration signale « distance manquante » pour les images déjà calées.
3. **Rappel visible côté admin** : sur la vignette d'une étape sans distance, un point d'avertissement, pour repérer d'un coup d'œil les étapes à compléter.

## Détails techniques

- `src/components/arena/LiveCoursesTab.tsx` et `src/components/arena/LiveCoursePanel.tsx` : supprimer le repli `observedTotalKm` (max des `kmRemaining` observés) ; `stageTotalKm` / `desktopTotalKm` valent uniquement `Number(distance_km)` ou `null`. `StageProgressOverlay` retourne déjà `null` si `totalKm` n'est pas exploitable, donc aucun autre changement n'est nécessaire pour masquer le repère.
- `src/components/startlist/RouteImageUploader.tsx` : afficher un avertissement discret sous le champ « Distance (km) » quand `distance_km` est nul, et un point d'alerte sur les vignettes des étapes sans distance.
- Données : renseigner `course_route_images.distance_km` pour l'étape 14 (154,5) via l'écran d'administration ; les autres étapes Vuelta sans distance restent à compléter au fil des jours.
- Aucune migration, aucun changement de logique live ni de scraping.
