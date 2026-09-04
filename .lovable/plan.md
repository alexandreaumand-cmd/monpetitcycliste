# Caler le repère de progression sur l'échelle réelle du profil

## Le problème
Le repère est aujourd'hui placé en supposant que l'image va de 0 km (bord gauche) à la distance totale (bord droit). Sur l'étape en cours ce n'est pas le cas : l'axe imprimé sur l'image commence à 61 km et se termine à 192,8 km, et le dessin ne touche pas exactement les bords de l'image. Résultat : à 40,2 km restants (soit 152,6 km parcourus) le repère tombe trop à droite, après 159,5.

## Ce qui change
Chaque image de profil pourra être calée une fois pour toutes, dans l'écran super-admin où l'on gère déjà les images de parcours et la distance :

- « km au repère gauche » (ex. 61) et « km au repère droit » (ex. 192,8) : les deux valeurs lues sur l'axe de l'image.
- « position du repère gauche » et « position du repère droit », exprimées en pourcentage de la largeur de l'image (ex. 1 % et 96 %), pour tenir compte des marges du dessin.
- Un aperçu sous les champs montre l'image avec deux traits fins aux positions saisies et un aperçu du repère à une distance de test, afin de vérifier le calage à l'œil.

Le repère du live utilise ensuite cette échelle. Si le calage n'est pas renseigné pour une image, on garde le comportement actuel (0 → distance totale sur toute la largeur), donc rien ne casse ailleurs.

## Détails techniques
- Migration : ajouter à `course_route_images` les colonnes `axis_start_km numeric null`, `axis_end_km numeric null`, `axis_left_pct numeric null`, `axis_right_pct numeric null`. RLS et GRANT existants inchangés.
- `src/components/startlist/RouteImageUploader.tsx` : à côté du champ « Distance (km) » déjà présent, quatre champs numériques enregistrés sur `blur` (même mutation `update` par `course_id` + `etape_numero`), plus le petit aperçu de calage.
- `src/components/arena/StageProgressOverlay.tsx` : nouvelles props optionnelles `axisStartKm`, `axisEndKm`, `axisLeftPct`, `axisRightPct`. Calcul :
  `parcouru = total − kmRestants` ; `pct = leftPct + (parcouru − startKm) / (endKm − startKm) × (rightPct − leftPct)`, borné à `[leftPct, rightPct]`. Sans calage, on retombe sur la formule actuelle. Le voile « déjà parcouru » s'arrête à la même position.
- `src/components/arena/LiveCoursePanel.tsx`, `LiveCoursesTab.tsx`, `StageProfileZoomDialog.tsx` : ajouter les quatre champs aux `select` de `course-route-images` déjà en place et les transmettre à l'overlay (profil mobile, desktop et vue agrandie).
- Aucun changement de logique métier ni de scraping : la source reste `kmRemaining` de la situation de course.
