# Points de la course dans la startlist

## Objectif
Quand on ouvre la startlist d'une course dans une ligue, chaque carte « Manager au départ » affiche le nombre de points marqués par ce manager **sur cette course précise**, et les managers sont classés du plus grand au plus petit total (le meilleur en haut à gauche).

## Comportement
- Nouvelle ligne sous « Phase » et « CG » : `Course: 412pts` (0pts si le manager n'a encore rien marqué, par ex. avant le départ).
- Points comptés : points des coureurs du manager (roster de la phase, dans cette ligue) sur cette course, toutes étapes et tous classements confondus, plus les bonus attribués sur cette course (bonus coureur et bonus manager), pour rester cohérent avec le classement de la ligue.
- Tri des cartes : points sur la course décroissants ; à égalité, on garde l'ordre actuel (note en étoiles, puis nombre de partants, puis nom).
- Même affichage et même tri sur mobile (ligne `Course: Xpts` à côté de `Ph:` / `CG:`).
- Vue super-admin sans ligue : inchangée (aucun manager affiché).

## Détails techniques
- `supabase/functions/startlist-manager-view/index.ts` : ajout d'un calcul `points_course` par manager
  - somme de `points_ledger.points` jointe à `rosters` (même `phase_id`, `league_id` de la requête) filtrée sur `course_id = race.id`, en respectant les scopes de la ligue comme le fait déjà `get_daily_points_by_manager` ;
  - ajout des bonus de cette course depuis `bonus_points` et `manager_bonus_points` (filtre `course_id` + `league_id`) ;
  - exposition du champ `points_course` dans chaque objet manager, et tri final par `points_course` décroissant.
- `src/components/startlist/StartlistDesktopExport.tsx` : passage de la grille de classements en 3 colonnes pour intégrer « Course », en gardant les tokens de couleur existants.
- `src/pages/Startlist.mobile.tsx` : ajout de `Course: Xpts` dans la ligne des classements.
- Aucun changement de schéma ni de logique de calcul des points.
