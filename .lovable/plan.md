

## Rendre la tête du coureur visible sur la photo de fond (mobile)

### Problème

Sur mobile (390px), la section AuctionShowcase empile le texte + le screenshot verticalement, ce qui crée une section haute. La photo de fond (`peloton-finish.jpg`) utilise `object-cover` sans position spécifique, donc le point focal (la tête du coureur) est coupé — le navigateur centre par défaut au milieu de l'image.

### Options possibles

1. **Ajuster `object-position` sur mobile** — Comme pour le hero, utiliser `object-[center_20%]` ou similaire pour remonter le point focal vers le haut de l'image où se trouve le coureur. Simple et rapide.

2. **Réduire le padding vertical sur mobile** — Passer de `py-24` à `py-16` sur mobile pour que la section soit moins haute et que la photo couvre mieux la zone visible.

3. **Combiner les deux** — Position + padding ajustés.

### Recommandation

Combiner les deux :
- `object-position: center 30%` sur mobile pour remonter le focal vers la tête
- Réduire le padding mobile à `py-16 md:py-36`

### Fichier impacté

- **`src/components/landing/AuctionShowcase.tsx`** — Ligne 17 : ajouter `object-[center_30%] sm:object-center` sur l'image de fond. Ligne 11 : changer `py-24` en `py-16`.

