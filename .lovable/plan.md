

## Optimisation mobile des pages Super Admin

### Probleme

Les pages Super Admin utilisent des composants desktop (tables HTML, TabsList en `grid-cols-4`, grids `md:grid-cols-3`) qui debordent ou sont illisibles sur un ecran de 393px. Le padding `p-4` du wrapper mobile s'ajoute au padding interne des composants, gaspillant de l'espace.

### Changements

**1. `src/pages/SuperAdminPage.mobile.tsx`** — Reduire le padding du wrapper
- `p-4` → `p-2` pour le conteneur principal des routes
- Reduire `pb-20` → `pb-16`

**2. `src/components/admin/CourseManagementTabs.tsx`** — Tabs responsives
- `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`
- Raccourcir les labels mobile : masquer le texte avec `hidden sm:inline` et garder uniquement les emojis sur mobile

**3. `src/components/admin/DataManagementTabs.tsx`** — Meme traitement
- `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`
- Labels courts sur mobile (emojis seuls)

**4. `src/pages/admin/SuperAdminBonusPage.tsx`** — Filtres et tabs responsifs
- Les 3 filtres `grid-cols-1 md:grid-cols-3` sont deja OK
- TabsList `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`
- Le `CardContent pt-6` → `pt-4` pour reduire l'espace

**5. `src/pages/admin/SuperAdminLeaguesPage.tsx`** — Reduire padding et espacement
- `space-y-6` → `space-y-4` globalement
- Le PageHeader est deja OK avec `p-3 sm:p-0`

**6. `src/components/admin/leagues/SuperAdminLeaguesTable.tsx`** — Table scrollable
- Ajouter `overflow-x-auto` autour de la table
- Sur mobile, masquer les colonnes moins essentielles (owner email, invite count) avec `hidden sm:table-cell`

**7. `src/pages/admin/UsersManagementPage.tsx`** — Table scrollable + colonnes cachees
- Ajouter `overflow-x-auto` autour de la table
- Masquer les colonnes secondaires (date inscription, dernier login) avec `hidden sm:table-cell` sur mobile
- Reduire la taille des badges et boutons d'action

**8. `src/components/admin/PointsLedgerTable.tsx`** — Table scrollable
- Ajouter `overflow-x-auto` autour de la table
- Masquer colonnes secondaires sur mobile

**9. `src/components/admin/BaremesManager.tsx`** — Meme pattern de table scrollable

**10. `src/components/admin/CoureursManager.tsx`** et `CoursesManager.tsx`** — Tables scrollables
- Ajouter `overflow-x-auto`
- Masquer colonnes non essentielles sur mobile

### Approche technique

Le pattern est repetitif : pour chaque composant contenant une `<Table>`, on enveloppe dans `<div className="overflow-x-auto -mx-2 px-2">` et on ajoute `hidden sm:table-cell` aux colonnes secondaires. Pour les `TabsList`, on passe en `grid-cols-2 sm:grid-cols-4` avec labels raccourcis.

### Fichiers impactes (10)
- `src/pages/SuperAdminPage.mobile.tsx`
- `src/components/admin/CourseManagementTabs.tsx`
- `src/components/admin/DataManagementTabs.tsx`
- `src/pages/admin/SuperAdminBonusPage.tsx`
- `src/pages/admin/SuperAdminLeaguesPage.tsx`
- `src/components/admin/leagues/SuperAdminLeaguesTable.tsx`
- `src/pages/admin/UsersManagementPage.tsx`
- `src/components/admin/PointsLedgerTable.tsx`
- `src/components/admin/CoureursManager.tsx`
- `src/components/admin/CoursesManager.tsx`

