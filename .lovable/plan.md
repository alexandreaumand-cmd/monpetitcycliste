

## Optimisation mobile du drawer Résultats de course

### Problemes identifies (images)

1. **Header trop volumineux** : titre en `text-xl` + badge catégorie + date prennent ~30% de l'ecran
2. **Onglet Managers** : le chevron est dans un `Button ghost` avec padding excessif, la colonne "Rang" affiche medaille + `#N` de facon espacee, les points sont en `text-lg` trop gros
3. **Section contributeurs expandee** : padding `p-4` et cartes avec `p-2 rounded border` gaspillent de l'espace vertical
4. **Colonnes inutilement larges** : la colonne chevron (`w-12`) et la colonne rang (`w-16`) sont surdimensionnees

### Changements

Dans `src/components/courses/CourseResultsDrawer.tsx` :

**1. Header compact mobile**
- Titre : `text-xl` → `text-base font-bold` (mobile seulement via classe conditionnelle ou `isMobile`)
- Badge categorie : plus petit `text-[10px]`
- Date : `text-xs` au lieu de `text-sm`

**2. Leaderboard (onglet Managers) — lignes 1040-1128**
- Supprimer la colonne chevron separee — integrer le chevron directement dans la cellule rang
- Fusionner rang + medaille en une seule cellule compacte : `🥇 #1` sans le `text-lg` sur la medaille
- Points : `text-lg font-bold` → `text-base font-bold`
- Ligne du tableau : reduire le padding vertical

**3. Section contributeurs expandee — lignes 1095-1121**
- `p-4` → `p-2`
- Cartes contributeurs : `p-2` → `p-1.5`, police plus petite
- Nom coureur : `font-medium` → `text-sm font-medium`
- Badge classement : deja `text-xs`, garder
- Points : `font-bold` → `text-sm font-bold`

**4. Header du tableau Managers**
- Supprimer la colonne vide `<TableHead className="w-12">` (chevron)
- `w-16` rang → `w-10`
- 3 colonnes au lieu de 4

### Fichier impacte
- `src/components/courses/CourseResultsDrawer.tsx` — header compact + leaderboard densite mobile

