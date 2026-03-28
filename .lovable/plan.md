

## Refonte du panneau "Situation de course" (côté droit) — style PCS avec barres verticales

### Problème

Le panneau latéral droit dans `LiveCoursesTab.tsx` (desktop + mobile) utilise un rendu custom inline au lieu du composant `RaceSituationDisplay` déjà refactoré avec le style PCS (badges numérotés, barres verticales, dossards, etc.). De plus, les écarts affichés (`+9:26`, `+15:43`...) sont les écarts GC individuels, pas les écarts entre groupes — ce qui est trompeur dans un contexte de situation de course.

### Solution

**Remplacer le rendu inline par `RaceSituationDisplay`** dans les deux sections (desktop et mobile) du panneau "Situation de course" de `LiveCoursesTab.tsx`. Ce composant gère déjà :
- Les badges numérotés (1, 2, 3… P)
- Les barres verticales colorées entre groupes
- Les écarts de groupe (gap entre groupes, pas GC)
- Les dossards et écarts GC par coureur (affichés à droite, séparément)
- Le label "PELOTON" et le `(-)` pour les coureurs sans manager

Le header `🏁 X km restants` sera retiré du panneau car `RaceSituationDisplay` l'affiche déjà en interne.

### Changement concret

Dans `LiveCoursesTab.tsx`, lignes 226-253 (desktop) et 277-299 (mobile) :

Remplacer le bloc de rendu custom par :
```tsx
<RaceSituationDisplay
  groups={latestSituation.groups}
  kmRemaining={latestSituation.kmRemaining}
  rosterOwners={rosterOwners}
/>
```

### Fichier impacté
- `src/components/arena/LiveCoursesTab.tsx` — remplacement du rendu inline par `RaceSituationDisplay` (desktop + mobile)

