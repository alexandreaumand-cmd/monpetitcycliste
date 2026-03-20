

## Corriger le débordement horizontal des cartes Pronostics sur mobile

### Problème

Sur un écran 393px, la ligne 1 de chaque `PronosticRaceCard` empile horizontalement : nom de course + badge type + badge catégorie + horloge deadline + icône statut. Tout ne rentre pas, ce qui provoque un débordement à droite.

### Solution

Restructurer le layout de la carte sur 2 lignes distinctes au lieu d'une seule ligne surchargée :

**Ligne 1** : Nom de la course (truncate, `flex-1`) + icône statut (shrink-0)

**Ligne 2** : Badge type + badge catégorie (optionnel, truncate) + horloge deadline — le tout en `flex-wrap` pour que ça retourne à la ligne si nécessaire

Le sélecteur/résultat (ligne 3) reste inchangé.

### Fichier impacté

- **`src/components/arena/PronosticRaceCard.tsx`** — Restructurer le bloc lignes 128-149 : séparer le titre + statut sur une ligne, et les badges + deadline sur une seconde ligne avec `flex-wrap gap-1`.

