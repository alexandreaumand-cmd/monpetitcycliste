

## Vérification compatibilité mobile — Page Live (ligues) et Live Broadcast (admin)

### Analyse des composants

**LiveCoursesTab (page Live des ligues)** :
- Layout `flex-col lg:flex-row` → sur mobile, tout s'empile verticalement ✅
- Panneau "Situation de course" : collapsible `lg:hidden` sur mobile ✅
- Hauteur fixe `h-[calc(100vh-260px)]` → peut poser problème sur mobile avec des hauteurs de header variables

**RaceSituationDisplay** (utilisé partout) :
- `RiderRow` : affiche rang + dossard + nom + propriétaire + écart GC sur une seule ligne. Sur un écran étroit (~320px), cette ligne peut déborder car il n'y a pas de `overflow-hidden` sur le conteneur de la ligne, et le `truncate` sur le nom a besoin d'un parent à largeur contrainte
- Le conteneur parent a `flex-1 min-w-0` mais la `RiderRow` elle-même n'a pas `min-w-0` → le texte peut pousser au-delà

**SuperAdminLiveBroadcastPage** :
- Grid `grid-cols-1 lg:grid-cols-2` → s'empile sur mobile ✅
- Barre URL d'import : `flex items-center gap-2` avec Input + 2 boutons → peut être serré sur mobile, mais les `shrink-0` sur les boutons protègent le layout ✅
- Le sticky `lg:sticky lg:top-20` ne s'applique pas sur mobile → pas de problème ✅

### Problèmes identifiés

1. **RiderRow overflow sur mobile** : la ligne avec 5 éléments (rang, dossard, nom, propriétaire, gcGap) n'a pas de `min-w-0` ni `overflow-hidden`, ce qui peut provoquer un débordement horizontal sur les écrans < 360px
2. **Hauteur LiveCoursesTab** : `h-[calc(100vh-260px)]` est un magic number qui ne s'adapte pas aux différentes tailles de header/nav mobile

### Changements proposés

#### 1. Fix RiderRow overflow (`RaceSituationDisplay.tsx`)
- Ajouter `min-w-0 overflow-hidden` sur le conteneur de la `RiderRow` (ligne 158)
- Réduire le gap sur mobile et s'assurer que le nom tronque correctement

```tsx
// Ligne 158 : ajouter min-w-0
<div className="flex items-center gap-1 sm:gap-1.5 text-xs leading-relaxed min-w-0">
```

#### 2. Fix hauteur mobile LiveCoursesTab (`LiveCoursesTab.tsx`)
- Remplacer le magic number par une hauteur plus adaptative sur mobile :
```tsx
className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-200px)] lg:h-[calc(100vh-260px)] min-h-[400px]"
```

### Fichiers impactés
- `src/components/arena/RaceSituationDisplay.tsx` — fix overflow RiderRow
- `src/components/arena/LiveCoursesTab.tsx` — hauteur responsive

