# Simplifier le calage du profil d'étape

## Ce qui change

Les quatre champs de calage disparaissent. Il ne reste qu'une saisie et un geste :

1. **Distance (km)** de l'étape — la seule valeur à taper.
2. Sous l'image, deux petites poignées à glisser : l'une sur le **départ (0 km)** du dessin, l'autre sur l'**arrivée**. On les pose une fois, à l'œil, et c'est fini.

Un curseur de test « km restants » permet de vérifier tout de suite que le repère tombe au bon endroit.

Si les poignées n'ont jamais été déplacées, elles sont posées par défaut aux bords de l'image : le comportement reste celui d'aujourd'hui, rien ne casse sur les images déjà en place.

## Détails techniques

- Base : aucune migration. On réutilise les colonnes existantes `axis_left_pct` / `axis_right_pct` pour les positions des poignées, et on **cesse d'utiliser** `axis_start_km` / `axis_end_km` (laissées nulles ; l'origine est toujours 0 km et la fin toujours `distance_km`).
- `src/components/startlist/RouteImageUploader.tsx` : supprimer les quatre champs numériques de calage ajoutés précédemment ; ne garder que « Distance (km) ». Ajouter sous l'aperçu deux poignées glissables (Pointer Events, valeur en % de la largeur, bornées et ordonnées gauche < droite), enregistrement sur fin de glissement via la même mutation `update` (`course_id` + `etape_numero`). Ajouter un petit champ/curseur « km restants (test) » qui affiche le repère de prévisualisation.
- `src/components/arena/StageProgressOverlay.tsx` : simplifier — `pct = leftPct + (parcouru / total) × (rightPct − leftPct)`, avec `leftPct = 0` et `rightPct = 100` par défaut. Retirer la prise en compte de `axisStartKm` / `axisEndKm` (props supprimées de `StageAxisCalibration`).
- `src/components/arena/StageProfileZoomDialog.tsx`, `LiveCoursePanel.tsx`, `LiveCoursesTab.tsx` : retirer les props et les colonnes `axis_start_km` / `axis_end_km` des `select`, garder `axis_left_pct` / `axis_right_pct`.
- Aucun changement de données live ni de logique métier.
