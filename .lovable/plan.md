

# Ajout du détail des courses sélectionnées (mode "À la course")

## Objectif
Sur la page admin de détail de ligue (`/admin/leagues/:id`), afficher la liste des courses sélectionnées lorsque la ligue est en mode `per_course`.

## Modifications

### `src/pages/admin/LeagueDetailPage.tsx`

1. **Étendre le type `League`** avec `game_mode`.
2. **Charger le scope en parallèle** des autres requêtes : récupérer `selected_course_ids` depuis `league_scopes` pour ce `leagueId`.
3. **Charger les noms des courses** depuis la table `courses` (sélection : `id, nom, date_debut, date_fin, categorie`) filtrées par les IDs récupérés, triées par `date_debut`.
4. **Nouvelle carte `<SelectedCoursesCard>`** affichée uniquement si `league.game_mode === 'per_course'` et que des courses existent. Insérée juste après `LeagueSettingsCard`.

### Contenu de la carte
- Titre : "Courses sélectionnées (N)"
- Tableau (réutilisation de `Table` shadcn) avec colonnes :
  - Nom de la course
  - Catégorie (Badge)
  - Date début → date fin (format court FR)
- État vide : message "Aucune course sélectionnée pour cette ligue."

## Fichiers modifiés
1. `src/pages/admin/LeagueDetailPage.tsx` — ajout du chargement scope + courses, nouveau composant `SelectedCoursesCard`.

