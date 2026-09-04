# Agrandir le profil de l'étape dans la page Live

## Objectif
Dans la page Live d'une ligue, pouvoir voir le profil de l'étape en grand, en plein écran, avec possibilité de zoomer.

## Comportement proposé
- Le profil affiché dans le bloc « Profil » devient cliquable (curseur loupe) et un petit bouton « Agrandir » apparaît en haut à droite du bloc.
- Le clic ouvre une fenêtre plein écran sombre affichant le profil au maximum de la place disponible.
- Dans cette fenêtre : molette (ou pincement à deux doigts sur mobile) pour zoomer, glisser pour déplacer l'image quand elle est zoomée, boutons + / − / réinitialiser, fermeture par la croix, par l'extérieur ou par la touche Échap.
- Le titre rappelle la course et le numéro d'étape.

## Détails techniques
- Modification de `src/components/arena/LiveCoursePanel.tsx` uniquement (plus un nouveau composant).
- Nouveau composant `src/components/arena/StageProfileZoomDialog.tsx` : `Dialog` shadcn avec contenu quasi plein écran (`max-w-[96vw] h-[92vh]`), fond via tokens existants.
- Zoom/pan implémenté avec `react-zoom-pan-pinch` s'il est déjà présent dans les dépendances ; sinon zoom maison : écouteur `wheel` natif non passif, facteur exponentiel `Math.exp(-dy * 0.0015)` borné entre 1 et 6, ancrage sur le curseur, `transform-origin: 0 0`, glissement via Pointer Events et `touch-action: none`.
- Aucun changement de données ni de logique métier : la même `stageImage` déjà chargée est réutilisée.
