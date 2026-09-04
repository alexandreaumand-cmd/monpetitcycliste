# Correction du débordement sur les cartes manager en mobile (Startlist)

## Objectif
Sur la page Startlist mobile, dans la vue d'une course, les cartes « Managers au départ » débordent à droite : le badge « X coureurs » et la ligne de stats (Ph / CG / Course) sont coupés.

## Diagnostic
Le débordement vient de la section infos manager dans `src/pages/Startlist.mobile.tsx` (vue `viewMode === "view"`) :
- Le badge de comptage de coureurs est dans la même ligne que le nom du manager, sans garantie de retour à la ligne.
- La ligne des classements (`Ph: #X … CG: #X … Course: Xpts`) est en `flex gap-2` sur une seule ligne sans `flex-wrap`, ce qui dépasse la largeur de la carte sur écran étroit.

## Plan de correction
1. **Adapter le layout du header de carte manager**
   - Dans `src/pages/Startlist.mobile.tsx`, reprendre le bloc `AccordionTrigger` affichant chaque manager.
   - Permettre au badge « X coureurs » de passer à la ligne si le nom est long (`flex-wrap` sur la ligne nom + badge).
   - Ajouter `shrink-0` au badge pour qu'il ne soit pas compressé.

2. **Faire wrapper la ligne de stats**
   - Remplacer la ligne unique `Ph / CG / Course` par un conteneur `flex flex-wrap`.
   - Réduire légèrement la taille de police (`text-[11px]` ou `text-xs`) et l'espacement (`gap-x-2 gap-y-0.5`).
   - Prévoir un retour à la ligne propre si les trois stats ne tiennent pas en largeur.

3. **Conserver les informations affichées**
   - Garder `Ph: #rank (points)`, `CG: #rank (points)` et `Course: Xpts`.
   - Conserver le tri par `points_course` décroissant déjà en place côté Edge Function.
   - Ne pas modifier le calcul des points ni l'ordre d'affichage des managers.

4. **Vérification visuelle**
   - Vérifier le rendu sur la largeur mobile (~393 px) avec le contenu du screenshot (noms longs, gros chiffres de points).
   - S'assurer qu'il n'y a plus de troncature horizontale ni de débordement.

## Fichiers concernés
- `src/pages/Startlist.mobile.tsx` uniquement.

## Non concerné
- Aucun changement de logique métier, de base de données, d'Edge Function, ni de version desktop.
