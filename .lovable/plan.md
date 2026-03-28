

## Fix : masquer le sélecteur de phase sur la page Résultats pour les ligues "à la course"

### Problème

La page Résultats (desktop) affiche un sélecteur de phase même pour les ligues en mode `per_course`, où la notion de phase est redondante — comme déjà corrigé sur les pages Mon Équipe et Classement.

### Solution

Ajouter la même vérification `isPerCourse` déjà utilisée dans les autres pages : importer `useUserLeagues`, détecter le `game_mode`, et conditionner l'affichage du sélecteur de phase avec `{!isPerCourse && ...}`.

### Fichiers impactés

1. **`src/pages/ResultsPage.desktop.tsx`** (lignes 182-198) — entourer le bloc `<Select>` de phase avec `{!isPerCourse && (...)}`, ajouter les imports `useUserLeagues` et la détection du mode
2. **`src/pages/ResultsPage.mobile.tsx`** — vérifier si un sélecteur de phase existe (il semble que non d'après le code, `phase_id: null` est hardcodé), mais ajouter la même garde par cohérence si nécessaire

