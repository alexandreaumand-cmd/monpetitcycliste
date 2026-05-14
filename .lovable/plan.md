## Objectif

Améliorer le classement des pronostics dans Arène > Pronostics > Classement avec deux nouvelles fonctionnalités :

1. Cliquer sur un manager ouvre un détail listant ses pronostics gagnants.
2. Pouvoir filtrer le classement par course (ex. Giro d'Italia, Tour de France…).

## 1. Filtre par course

Au-dessus de la liste du classement (`PronosticStandings.tsx`), ajouter un sélecteur (Select shadcn) avec :
- Option par défaut : « Toutes les courses » (comportement actuel).
- Une option par course présente dans `arena_pronostic_deadlines` pour la ligue (jointure `courses.nom`), triée par date de début descendante.

Quand une course est sélectionnée, le classement recalcule `correct_count` / `total_count` uniquement sur les pronostics liés à ce `course_id`.

Implémentation :
- Nouveau hook `usePronosticCoursesForLeague(leagueId)` qui retourne la liste distincte des courses ayant au moins une deadline pour la ligue.
- Étendre `usePronosticStandings(leagueId, courseId?)` :
  - Si `courseId` est null → continuer d'appeler le RPC existant `get_arena_pronostic_standings`.
  - Sinon → faire une requête côté client sur `arena_pronostics` filtrée par `league_id` + `course_id`, agréger par manager (count des `is_correct = true` et total des `is_correct != null`), joindre `managers(nom, avatar_url)`, trier par correct desc.
- Aucun changement SQL nécessaire (option simple). Alternative possible : nouveau RPC `get_arena_pronostic_standings_by_course` (à décider si volume important).

## 2. Détail d'un manager (pronostics gagnants)

Rendre chaque ligne du classement cliquable. Au clic, ouvrir un `Dialog` shadcn « Pronostics gagnants — {nom du manager} » contenant :
- Liste des pronostics où `is_correct = true` pour ce manager dans la ligue (et filtrée par course si un filtre est actif).
- Chaque entrée affiche : nom de la course (+ numéro d'étape si présent), type de pronostic (Vainqueur d'étape / Général / Course d'un jour…), nom du coureur ou de l'équipe choisi, date de la deadline.
- État vide : « Aucun pronostic gagnant pour le moment ».

Implémentation :
- Nouveau hook `useManagerWinningPronostics(leagueId, managerId, courseId?)` qui sélectionne `arena_pronostics` filtrés `is_correct = true`, hydrate les noms coureur/équipe et joint `courses(nom)` + `arena_pronostic_deadlines` pour récupérer `pronostic_type`/`etape_numero` (déjà sur `arena_pronostics`).
- Nouveau composant `ManagerPronosticsDialog.tsx`.

## Fichiers à créer / modifier

- `src/hooks/useArenaPronostics.ts` — ajouter `usePronosticCoursesForLeague`, `useManagerWinningPronostics`, étendre `usePronosticStandings` avec un `courseId` optionnel.
- `src/components/arena/PronosticStandings.tsx` — ajouter le Select de filtre course, gérer l'état local sélection, rendre chaque ligne cliquable (bouton accessible), ouvrir le dialog.
- `src/components/arena/ManagerPronosticsDialog.tsx` — nouveau, dialog liste des bons pronostics.
- `src/i18n/locales/fr/arena.json` + `en/arena.json` — clés :
  - `pronostics.standings.filterByCourse` / `allCourses`
  - `pronostics.standings.managerDetailTitle`
  - `pronostics.standings.winningEmpty`
  - libellés types de pronostic si non présents (`stageWinner`, `gcWinner`, `oneDayWinner`).

## Hors périmètre

- Pas de changement du RPC SQL existant (sauf si tu veux que je crée un RPC dédié pour les perfs).
- Pas de modification du flux de saisie ni des autres onglets de l'Arène.
