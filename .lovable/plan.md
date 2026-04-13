

# Plan : Afficher les courses sélectionnées sur les cartes de ligue (Dashboard)

## Modifications

### 1. `src/hooks/useLeagueCardsData.ts`
- Enrichir la requête `league_scopes` (BATCH 4) pour récupérer aussi `selected_course_ids` en plus de `league_id` et `season_id`
- Collecter tous les `selected_course_ids` de toutes les ligues et faire une requête batch sur la table `courses` pour résoudre les noms
- Ajouter `selectedCourseNames: string[]` à l'interface `LeagueCardData`
- Pour chaque ligue en mode `per_course`, mapper les IDs vers les noms et les stocker dans le résultat

### 2. `src/components/dashboard/LeagueCard.tsx`
- Lire `cardData.selectedCourseNames` 
- Sous la ligne des badges (mode/saison/joueurs), afficher les courses en badges compacts quand `league.game_mode === 'per_course'` et que la liste n'est pas vide
- Utiliser des `Badge variant="outline"` avec une icône `MapPin` ou similaire, dans un conteneur flex-wrap avec un style discret

### 3. `src/i18n/locales/fr/dashboard.json` et `en/dashboard.json`
- Ajouter une clé `leagueCard.selectedCourses` ("Courses sélectionnées" / "Selected courses") si besoin d'un label

## Rendu attendu
Sous les badges existants (mode, saison, joueurs), une ligne de petits badges avec les noms des courses pour les ligues "à la course".

