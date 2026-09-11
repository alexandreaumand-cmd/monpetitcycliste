# Trier les mouvements de startlists par attribution

## Changement
Dans chaque course et chaque date, afficher les mouvements dans cet ordre :
1. Mes coureurs, qu'ils soient ajoutés ou retirés.
2. Les coureurs attribués à un autre manager.
3. Les coureurs sans manager.

L'ordre actuel de détection est conservé à l'intérieur de chacune de ces trois catégories. Le même tri s'applique au tableau desktop et aux cartes mobile, sans modifier les données ni les couleurs existantes.

## Détail technique
- Trier les éléments de chaque course après chargement de l'effectif et du manager connecté.
- Calculer une priorité stable à partir du propriétaire du coureur : `0` pour moi, `1` pour un autre manager, `2` sans manager.
- Conserver la date de détection décroissante en second critère.
