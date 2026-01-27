

# Suppression complète du barème dans CourseResultsDrawer

## Objectif

Supprimer entièrement les sections "Voir le barème des points" du drawer des résultats de course.

---

## Modifications à apporter

### Fichier : `src/components/courses/CourseResultsDrawer.tsx`

**2 suppressions :**

| Ligne | Section | Action |
|-------|---------|--------|
| 517-519 | Onglet "Finals" | Supprimer `<PointsBaremeSection courseId={courseId} typeClassement={selectedType} />` |
| 729-730 | Onglet "Stages" | Supprimer `<PointsBaremeSection courseId={courseId} typeClassement="Etape" />` |

**Import à supprimer (ligne 19) :**
```tsx
import { PointsBaremeSection } from "./PointsBaremeSection";
```

---

## Résultat

L'interface sera plus épurée avec uniquement :
- Le dropdown de sélection d'étape
- Le tableau des résultats

Plus aucune mention du barème dans le drawer des résultats.

