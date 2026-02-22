

## Correction de l'ecran coupe sur mobile

### Probleme

Le composant `TabGroup` utilise `min-w-fit` et `whitespace-nowrap` sur chaque bouton d'onglet, ce qui empeche les boutons de se reduire en dessous de la largeur de leur texte. Avec 4 onglets ("En cours", "A venir", "Passes", "Classement"), la largeur totale depasse l'ecran sur mobile. Le `overflow-x-auto` permet de scroller les onglets mais ne contraint pas la largeur du conteneur parent, ce qui pousse tout le contenu a deborder.

### Solution

Modifier le `TabGroup` pour que les boutons puissent se reduire et rester dans la largeur de l'ecran :

| Fichier | Modification |
|---------|-------------|
| `src/components/mobile/TabGroup.tsx` | Remplacer `min-w-fit` par `min-w-0` sur les boutons, et retirer `whitespace-nowrap` pour permettre le retour a la ligne si necessaire. Ajouter `text-center` pour garder l'alignement. Aussi, ajouter `w-full` au conteneur pour s'assurer qu'il prend la largeur du parent et non plus. |
| `src/components/arena/PronosticsTab.tsx` | Ajouter `max-w-full overflow-hidden` au conteneur principal (ligne 128) pour empecher tout debordement |

### Details techniques

**TabGroup.tsx ligne 34** : `"flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap"` devient `"flex-1 min-w-0 px-2 py-2 text-xs font-medium rounded-md transition-all text-center"` -- les boutons peuvent desormais se reduire, le padding est reduit, et le texte est plus petit pour mieux tenir.

**TabGroup.tsx ligne 22** : ajouter `w-full` au conteneur flex pour contraindre sa largeur a celle du parent.

**PronosticsTab.tsx ligne 128** : `<div className="space-y-4">` devient `<div className="space-y-4 max-w-full overflow-hidden">` pour securiser au niveau du composant.
