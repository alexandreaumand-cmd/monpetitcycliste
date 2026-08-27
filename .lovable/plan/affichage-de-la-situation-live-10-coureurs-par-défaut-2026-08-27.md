# Affichage de la Situation Live : 10 coureurs par défaut

## Objectif
Dans la colonne **Situation** de l'Arène Live, afficher **10 coureurs par défaut** dans chaque groupe au lieu de 5, tout en conservant le bouton d'expansion pour voir les coureurs supplémentaires.

## Comportement
- Chaque groupe de coureurs affiche jusqu'à 10 lignes par défaut.
- Si un groupe contient plus de 10 coureurs, un bouton « +X autres » permet de déplier le reste.
- Si un groupe contient 10 coureurs ou moins, aucun bouton d'expansion n'apparaît.

## Fichier concerné
- `src/components/arena/RaceSituationDisplay.tsx`
  - Modifier le seuil `riderItems.length > 5` en `> 10`.
  - Modifier le `slice(0, 5)` en `slice(0, 10)`.
  - Le libellé « +X autres » reste calculé dynamiquement, aucun changement de traduction requis.

## Vérification
- Build OK.
- Visuellement, dans la Situation Live avec un groupe de plus de 10 coureurs, 10 coureurs apparaissent par défaut et le bouton « +X autres » déploie le reste.
