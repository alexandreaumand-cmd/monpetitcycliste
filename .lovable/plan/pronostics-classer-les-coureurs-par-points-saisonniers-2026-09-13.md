# Pronostics : classer les coureurs par points saisonniers

## Objectif
Rendre le choix d’un pronostic plus utile en mettant en avant les coureurs les plus performants de la saison en cours.

## Comportement attendu
- Dans chaque liste de coureurs d’un pronostic, trier d’abord par total de points saisonniers décroissant.
- En cas d’égalité de points, trier les coureurs par ordre alphabétique.
- Afficher le total à droite de chaque coureur, au format « 1 234 pts ».
- Conserver le nom de l’équipe sous le nom du coureur, ainsi que la recherche par nom ou équipe.
- Les coureurs sans point restent visibles en bas de liste avec « 0 pt ».
- Ne pas modifier les pronostics par équipes (TTT).

## Mise en œuvre
- Enrichir le chargement de la startlist avec la saison associée à la course et les totaux fournis par la source saisonnière existante `get_riders_data_for_season`.
- Ajouter le total de points au modèle des coureurs disponibles.
- Appliquer le tri points décroissants, puis nom alphabétique, avant et après une recherche.
- Adapter la ligne du sélecteur pour afficher les points sans provoquer de débordement sur mobile.

## Vérification
- Tester une liste avec des scores différents et plusieurs coureurs à égalité.
- Vérifier la recherche, la sélection et la sauvegarde d’un pronostic.
- Contrôler l’affichage sur mobile à 393 px et sur ordinateur.
