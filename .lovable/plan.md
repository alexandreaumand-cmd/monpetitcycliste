# Optimiser la fiche course du calendrier sur mobile

## Objectif
Rendre la fiche d’une course facile à parcourir sur mobile et rendre immédiatement accessible la section « Mouvements startlist ».

## Modifications
- Adapter la fenêtre à la hauteur réelle de l’écran mobile, avec un seul défilement principal fiable.
- Placer « Mouvements startlist » avant la longue liste des coureurs sur mobile, tout en conservant sa position actuelle sur ordinateur.
- Ouvrir cette section par défaut lorsqu’elle contient des mouvements, avec son compteur visible.
- Supprimer le défilement imbriqué de la liste des coureurs sur mobile afin d’éviter le blocage observé en bas de liste.
- Réduire légèrement les espacements de l’en-tête et du contenu sur petit écran, sans modifier les données affichées.

## Vérification
- Tester la fiche à 393 px de large avec une longue startlist.
- Vérifier l’accès aux mouvements, l’ouverture/repli de la section et le défilement jusqu’au bas de la fenêtre.
- Contrôler que l’affichage ordinateur reste inchangé.
