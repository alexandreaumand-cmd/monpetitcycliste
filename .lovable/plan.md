

## Correction de la largeur d'ecran sur mobile (production)

### Probleme

Le conteneur racine du `MobileLayout` (`<div className="min-h-screen bg-background pb-20">`) n'a aucune contrainte de largeur maximale. Quand un element enfant (comme une vignette de pronostic avec des badges ou un combobox) depasse legerement la largeur du viewport, il etire le `div` racine, ce qui elargit toute la page. Le `overflow-x-hidden` sur `<main>` seul ne suffit pas car le parent n'est pas contraint.

La preview fonctionne car l'iframe impose deja une largeur fixe, mais sur un vrai telephone il n'y a rien qui empeche le div racine de s'etirer.

### Solution

Appliquer `max-w-[100vw] overflow-x-hidden` au conteneur racine du `MobileLayout` pour que rien ne puisse jamais depasser la largeur de l'ecran, quel que soit le contenu des vignettes.

### Modifications

| Fichier | Modification |
|---------|-------------|
| `src/components/mobile/MobileLayout.tsx` | Ajouter `max-w-[100vw] overflow-x-hidden` au `div` racine (ligne 40) |

### Detail technique

**MobileLayout.tsx ligne 40** : `<div className="min-h-screen bg-background pb-20">` devient `<div className="min-h-screen bg-background pb-20 max-w-[100vw] overflow-x-hidden">`. Cela garantit que le conteneur racine ne depasse jamais la largeur du viewport, et tout contenu debordant sera coupe. C'est la contrainte la plus haute dans la hierarchie, ce qui resout le probleme a la source.

