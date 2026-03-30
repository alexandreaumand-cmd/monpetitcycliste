

## Fix: Tooltips invisibles dans le CourseSelector (Dialog)

### Probleme
Le `CourseSelector` est affiché dans un `Dialog` (z-index ~50). Les `TooltipContent` utilisent un portal qui se rend derrière le dialog, donc les tooltips sont cachés.

### Solution
Ajouter `className="z-[100]"` sur chaque `<TooltipContent>` dans `CourseSelector.tsx` pour que les tooltips s'affichent au-dessus du dialog.

### Fichier impacte (1)
- `src/components/leagues/CourseSelector.tsx` — ajouter `className="z-[100]"` à tous les `<TooltipContent>`

