# Ajout de la course obligatoire pour le bonus "First Win"

## Contexte

Lors des derniers échanges, on a établi que le bonus **First Win** doit être rattaché à une course (la course sur laquelle le coureur a remporté sa 1ère victoire de carrière). C'est le `course_id` qui détermine ensuite, côté `get-rider-points-table`, dans quelles ligues ce bonus apparaît (uniquement les ligues dont le scope contient cette course).

Aujourd'hui, dans le formulaire super-admin "Nouveau Bonus Coureur", il n'y a pas de champ Course → toutes les insertions partent avec `course_id = NULL` et le bonus n'apparaît correctement dans aucune ligue par-course.

## Ce qui change

### 1. Formulaire "Nouveau Bonus Coureur" (super-admin)
Fichier : `src/components/admin/bonus/RiderBonusTab.tsx`

- Ajouter un champ **Course** (combobox cherchable, listant les courses de la saison sélectionnée).
- Le champ est :
  - **obligatoire** quand `bonus_type = 'first_win'`
  - **obligatoire** quand `bonus_type = 'itt'` (cohérent : un ITT a lieu sur une course précise)
  - **caché / optionnel** quand `bonus_type = 'coureur_bonuse'` (bonus +25% calculé par phase, pas par course)
- Bloquer le bouton "Enregistrer" tant qu'aucune course n'est choisie pour les types qui l'exigent.
- À l'insertion dans `bonus_points`, transmettre `course_id` (la table a déjà la colonne, la logique de filtrage par ligue dans `get-rider-points-table` est déjà branchée).
- Reset du champ à la fermeture du dialog.

### 2. Tableau "Bonus Coureur attribués"
Même fichier — ajouter une colonne **Course** pour visualiser à quelle course chaque bonus est rattaché (libellé court de la course, ou `—` si NULL pour les `coureur_bonuse`).

### 3. (Optionnel — recommandé) Édition d'un bonus existant
Le dialog d'édition actuel ne permet de modifier que `points` et `commentaire`. Ajouter la possibilité de **rattacher/changer la course** pour les bonus `first_win` / `itt` existants — utile pour corriger les bonus 2026 déjà saisis sans course, comme tu l'as proposé.

## Détails techniques

- **Source des courses** : requête `useQuery` sur `courses` filtrée par `saison_id` (pattern déjà utilisé dans `CourseSelector.tsx`), triée par `date_debut`. Renvoie `{ id, course_nom, date_debut, categorie }`.
- **Composant UI** : Popover + Command (cherche par nom de course), même pattern que le `CourseMultiSelect` récemment créé, mais en sélection unique. Pas besoin d'extraire un composant — l'inliner dans le dialog suffit (utilisé à un seul endroit).
- **Validation** :
  ```ts
  const courseRequired = bonusType === 'first_win' || bonusType === 'itt';
  if (courseRequired && !selectedCourseId) {
    toast.error("La course est obligatoire pour ce type de bonus");
    return;
  }
  ```
- **Insert** : ajouter `course_id: selectedCourseId || null` aux objets passés à `supabase.from("bonus_points").insert(...)` dans les deux branches (multi-manager et mono-manager).
- **Aucune migration DB** nécessaire : `bonus_points.course_id text NULLABLE` existe déjà.
- **Aucune modif edge function** : `get-rider-points-table` filtre déjà les bonus avec `course_id` selon le scope de la ligue.

## Hors scope

- Les bonus `coureur_bonuse` (+25%) restent par phase, sans course.
- Les bonus manager (TTT, Scoreurs) ne sont pas concernés.
- Tu corrigeras ensuite manuellement (ou via le dialog d'édition au point 3) les bonus First Win 2026 déjà saisis sans course.
