

## Ajouter des tooltips explicatifs sur les filtres du CourseSelector

### Modification

**`src/components/leagues/CourseSelector.tsx`** :
- Importer `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` depuis `@/components/ui/tooltip`
- Envelopper chaque Badge de filtre (Tous, Étapes, 1 jour, WT, .Pro, .1, Autres) ainsi que les badges de tri (Date, Points) dans un `<Tooltip>` avec un `<TooltipContent>` explicatif
- Envelopper le tout dans un `<TooltipProvider>`

**`src/i18n/locales/fr/leagues.json`** — ajouter sous `settings` :
- `filterTooltipAll`: "Afficher toutes les courses"
- `filterTooltipStageRace`: "Courses à étapes (ex: Tour de France)"
- `filterTooltipOneDay`: "Courses d'un jour (ex: classiques)"
- `filterTooltipWT`: "World Tour — courses du plus haut niveau UCI"
- `filterTooltipPro`: "Courses de catégorie .Pro"
- `filterTooltip1`: "Courses de catégorie .1"
- `filterTooltipOthers`: "Autres catégories de courses"
- `sortTooltipDate`: "Trier par date de départ"
- `sortTooltipPoints`: "Trier par points théoriques décroissants"

**`src/i18n/locales/en/leagues.json`** — mêmes clés en anglais

### Fichiers impactés (3)
- `src/components/leagues/CourseSelector.tsx`
- `src/i18n/locales/fr/leagues.json`
- `src/i18n/locales/en/leagues.json`

