

## Masquer le sélecteur de phase dans les classements pour les ligues "à la course"

### Problème
Dans une ligue en mode `per_course` (comme "Ligue Flandriennes 2026"), le sélecteur de phase (Global / P1 / P2...) est affiché dans les classements alors qu'il n'a pas de sens — il n'y a qu'une seule phase technique.

### Solution
Détecter le `game_mode` de la ligue courante et masquer le sélecteur de phase quand c'est `per_course`. Forcer `selectedPhase = null` (vue Global) pour ces ligues.

Le pattern existe déjà dans `MyTeam.desktop.tsx` et `MyTeam.mobile.tsx` :
```typescript
const { leagues } = useUserLeagues();
const currentLeague = leagues.find(l => l.id === leagueId);
const isPerCourse = currentLeague?.game_mode === 'per_course';
```

### Fichiers impactés

#### 1. `src/pages/Rankings.tsx` (desktop)
- Importer `useUserLeagues`
- Dériver `isPerCourse` depuis la ligue courante
- Masquer le `<Select>` de phase si `isPerCourse`
- Forcer `selectedPhase = null` quand `isPerCourse`

#### 2. `src/pages/Rankings.mobile.tsx` (mobile)
- Même logique : importer `useUserLeagues`, dériver `isPerCourse`
- Masquer le `<Select>` de phase (lignes 313-328) si `isPerCourse`
- Forcer `selectedPhase = null` quand `isPerCourse`

