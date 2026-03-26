

## Afficher l'étape du jour par défaut dans la galerie d'images

### Problème
Quand on ouvre la startlist d'une course par étapes, l'image affichée est toujours l'étape 1. Il faudrait afficher l'étape du jour (ex: étape 4 de la Volta le 26 mars si la course a débuté le 23 mars).

### Solution
Ajouter une prop optionnelle `defaultStageNumber` à `RouteImageGallery` (et `RouteImageModalContent`). Le composant parent calcule le numéro d'étape du jour à partir de `date_debut` de la course : `étape = jours écoulés depuis date_debut + 1`. Le composant initialise `activeIndex` sur l'image correspondant à ce numéro d'étape (ou 0 si non trouvé).

### Fichiers impactés

**1. `src/components/startlist/RouteImageGallery.tsx`**
- Ajouter prop `defaultStageNumber?: number`
- Calculer l'index initial : chercher l'image dont `etape_numero === defaultStageNumber`, sinon index 0
- Appliquer à `useState(computedIndex)` au lieu de `useState(0)`
- Même logique pour `RouteImageModalContent`

**2. `src/pages/Startlist.mobile.tsx`**
- Calculer `todayStageNumber` depuis `startlistViewData.race.date_debut`
- Passer `defaultStageNumber={todayStageNumber}` aux deux `RouteImageGallery`

**3. `src/pages/Startlist.desktop.tsx`**
- Même calcul et passage de prop

**4. `src/components/startlist/StartlistDesktopExport.tsx`**
- Même calcul et passage de prop

### Calcul du numéro d'étape
```typescript
const todayStageNumber = useMemo(() => {
  if (!race?.date_debut) return undefined;
  const start = new Date(race.date_debut);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
  return diffDays >= 0 ? diffDays + 1 : undefined;
}, [race?.date_debut]);
```

