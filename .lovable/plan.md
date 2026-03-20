

## Corriger l'affichage du Hero sur écrans ~1000px de large

### Problème

À 1001×688px (viewport actuel), l'écran est juste en dessous du breakpoint `lg` (1024px), donc les titres utilisent `sm:text-4xl` (36px). Combiné avec la hauteur limitée (688px) et `min-h-[100svh]`, le bloc texte déborde et les mots sont coupés.

### Solution

Rendre la typographie du Hero responsive à la **hauteur** du viewport en plus de la largeur :

1. **`src/components/landing/HeroSection.tsx`** :
   - Remplacer les tailles fixes par des `clamp()` via des classes Tailwind arbitraires, pour que le texte s'adapte fluidement entre mobile et desktop
   - Utiliser `text-[clamp(1.75rem,4vw,4.5rem)]` sur les titres pour qu'ils se redimensionnent proportionnellement à la largeur du viewport
   - Réduire les marges/paddings du conteneur texte sur les écrans de hauteur limitée avec `md:py-6` au lieu de `md:py-8`
   - Réduire `mb-5` à `mb-3` sur le second titre, `mb-6` à `mb-4` sur les stripes
   - Boutons : passer à `py-5` au lieu de `py-6` pour gagner de l'espace vertical

Le résultat : un bloc texte qui reste lisible et contenu dans le viewport quelle que soit la combinaison largeur/hauteur.

