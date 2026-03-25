

## Masquer le sélecteur de phase en mode "à la course"

### Problème
L'écran "Mon Équipe" affiche un sélecteur de phase même pour les ligues en mode "à la course", où la notion de phase n'a pas de sens pour l'utilisateur.

### Solution
Conditionner l'affichage du sélecteur de phase au mode de jeu de la ligue courante. Si `game_mode === 'per_course'`, le sélecteur est masqué. La phase reste utilisée en interne (requêtes SQL) mais n'est plus visible.

### Fichiers à modifier

**1. `src/components/team/MyTeam.desktop.tsx`**
- Importer `useUserLeagues` pour accéder à `game_mode` de la ligue courante
- Dériver `isPerCourse` : `currentLeague?.game_mode === 'per_course'`
- Conditionner le bloc phase selector (lignes 599-612) avec `{!isPerCourse && phases.length > 0 && (...)}`

**2. `src/components/team/MyTeam.mobile.tsx`**
- Même logique : importer `useUserLeagues`, dériver `isPerCourse`
- Conditionner le bloc phase selector (autour de la ligne 408) avec `{!isPerCourse && phases.length > 0 && (...)}`

### Comportement attendu
- Mode "5 phases" : sélecteur de phase visible (inchangé)
- Mode "à la course" : sélecteur masqué, la phase active est toujours utilisée en arrière-plan pour les requêtes

