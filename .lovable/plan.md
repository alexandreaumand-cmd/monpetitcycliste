## Problème

Dans la fiche coureur (RiderPointsDetail) de Mathys Rondel ouverte par Max en ligue **MPC 2026**, on voit "Bonus 30 pts". Ces 30 pts (22,50 + 7,50) correspondent en réalité à des bonus `coureur_bonuse` (+25 %) attribués dans une **autre ligue** (CopaGIRO, `2b08ea2c-...`). Rondel n'est pas le coureur bonusé de Max en MPC 2026 — c'est bien un bug d'affichage.

## Cause racine

Dans `supabase/functions/get-rider-points-table/index.ts`, la requête bonus utilise ce filtre OR :

```ts
// Pseudo
course_id IN (courses de la ligue)
OR (course_id IS NULL AND league_id = current_league)
```

Cette logique a été conçue pour les bonus de type `first_win` qui n'ont pas de `league_id` (globaux). Mais les bonus `coureur_bonuse` ont **à la fois** un `course_id` (étape concernée) **et** un `league_id` (le coureur bonusé est lié à une ligue + phase + manager). La première branche du OR les laisse donc passer sans filtrage par ligue, et un coureur bonusé dans la ligue A est visible dans la ligue B dès que la course est dans le scope des deux ligues.

## Correctif

Resserrer le filtre dans `get-rider-points-table` : un bonus avec `league_id` non null doit toujours être filtré par la ligue courante, qu'il porte un `course_id` ou non. Les bonus avec `league_id` null restent globaux (visibles dans toute ligue dont le scope contient la course).

Nouveau filtre :

```text
( course_id IN league_courses AND (league_id IS NULL OR league_id = current_league) )
OR
( course_id IS NULL AND league_id = current_league )
```

Et quand aucun `league_id` n'est passé (vue hors ligue), on garde le comportement legacy (pas de filtrage par ligue, mais on n'expose pas les bonus à `league_id` non null d'une autre ligue : on ne renverra que les bonus globaux `league_id IS NULL`).

## Étapes

1. Mettre à jour la construction du `bonusQuery` dans `supabase/functions/get-rider-points-table/index.ts` avec la nouvelle expression OR.
2. Mettre à jour le commentaire d'intention au-dessus pour refléter la règle.
3. Déployer la fonction et vérifier en base :
   - Max (MPC 2026) sur Rondel ne voit plus de bonus.
   - Le manager qui a réellement bonusé Rondel en CopaGIRO voit toujours ses 30 pts.
   - Les bonus `first_win` (course_id rempli, league_id null) restent visibles dans toutes les ligues éligibles.

## Hors scope

Pas de changement UI, pas de modification du calcul de classement (`calculate-standings` est indépendant et applique déjà le bon scope). Pas de migration de données : les bonus existants restent corrects côté écriture.
