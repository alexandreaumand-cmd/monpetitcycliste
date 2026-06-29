## Pourquoi l'erreur ?

La course « à supprimer » a déjà des données rattachées :
- 1 ligne dans `race_results` (résultat de course)
- 1 ligne dans `race_result_sets` (jeu de résultats)
- 1 ligne dans `points_ledger` (points attribués)

Les clés étrangères `race_results.course_id`, `points_ledger.course_id` et `race_results_history.course_id` sont en `ON DELETE NO ACTION` (les autres tables liées, elles, sont déjà en CASCADE). La base refuse donc la suppression tant qu'il reste un résultat ou un point lié à la course.

## Correction proposée

Suppression « cascade contrôlée » côté application (pas de modification de schéma — on garde la sécurité actuelle qui empêche une suppression accidentelle).

### Étape 1 — Compter les dépendances avant suppression

Dans `CoursesManager.tsx`, avant d'appeler la suppression, interroger en parallèle :
- `race_results` (count)
- `race_result_sets` (count)
- `points_ledger` (count)
- `race_results_history` (count)

### Étape 2 — Confirmation enrichie

Remplacer le `window.confirm` actuel par une confirmation qui affiche le détail :

```
Supprimer la course "à supprimer" ?

Cette action supprimera également :
- 1 résultat de course
- 1 jeu de résultats
- 1 entrée de points

Action irréversible.
```

Si tous les compteurs sont à 0 → confirmation simple comme aujourd'hui.

### Étape 3 — Suppression en cascade ordonnée

Dans `deleteCourseMutation`, exécuter dans l'ordre :
1. `delete from points_ledger where course_id = ...`
2. `delete from race_results where course_id = ...`
3. `delete from race_result_sets where course_id = ...`
4. `delete from race_results_history where course_id = ...`
5. `delete from courses where id = ...`

Les autres dépendances (`arena_pronostics`, `arena_live_courses`, `course_route_images`, `course_stage_config`, `startlist_imports`, `league_startlist_notes`, `arena_pronostic_deadlines`, `arena_messages`) sont déjà en `ON DELETE CASCADE` / `SET NULL` — pas besoin de les toucher.

### Étape 4 — Gestion d'erreur

Si une étape échoue, afficher l'erreur exacte dans le toast (table + message) pour pouvoir diagnostiquer sans deviner.

## Fichiers modifiés

- `src/components/admin/CoursesManager.tsx` : nouvelle logique `handleDelete` (préchargement des compteurs + dialog de confirmation enrichi) et `deleteCourseMutation` (suppression ordonnée des dépendances).

Aucune migration SQL nécessaire.