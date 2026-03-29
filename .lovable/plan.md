

## Optimiser l'utilisation de l'espace sur la page Live desktop

### Problème

Le conteneur desktop utilise `h-[calc(100vh-260px)]` — l'offset de 260px est trop conservateur, ce qui laisse un grand espace blanc en bas. De plus, le gap entre le sélecteur de course et le panneau ajoute de l'espace inutile.

### Changements

**`src/components/arena/LiveCoursesTab.tsx`** (layout desktop, ligne 269) :
- Réduire l'offset : `h-[calc(100vh-260px)]` → `h-[calc(100vh-160px)]` pour occuper plus d'espace vertical
- Réduire le gap : `gap-3` → `gap-2`
- Réduire le padding du sélecteur : `px-4 py-3` → `px-3 py-2`

**`src/components/arena/LiveCoursePanel.tsx`** :
- Réduire les paddings internes des headers (timeline/situation) : `px-3 py-2` → `px-3 py-1.5`
- Réduire le padding du contenu situation : `p-3` → `p-2`

### Fichiers impactés
- `src/components/arena/LiveCoursesTab.tsx`
- `src/components/arena/LiveCoursePanel.tsx`

