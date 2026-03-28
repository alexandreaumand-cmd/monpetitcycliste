

## Ajouter le nombre de coureurs dans la colonne gauche (style PCS)

### Constat (image PCS)

Sur PCS, la colonne gauche de chaque groupe affiche **3 informations empilées** :
1. **Numéro du groupe** (1, 2, 3… ou P)
2. **Écart avec le groupe de tête** (+0:20, +1:30, +1:58, +2:24)
3. **Nombre de coureurs** dans le groupe (5, 2, 2, 6, 1)

Actuellement, notre `RaceSituationDisplay` n'affiche que le numéro et l'écart dans la colonne gauche. Le nombre de coureurs est absent.

### Changement

Dans `RaceSituationDisplay.tsx`, modifier la colonne gauche du `GroupRow` pour ajouter le `riderCount` sous l'écart :

```text
  ┌─────┐
  │  1  │   ← badge numéro
  └─────┘
  +1:30     ← écart (déjà présent)
   (2)      ← nombre de coureurs (NOUVEAU)
```

- Afficher `riderCount` pour tous les groupes (y compris le peloton)
- Style : `text-[10px] text-muted-foreground` entre parenthèses ou avec un petit indicateur visuel

### Fichier impacté
- `src/components/arena/RaceSituationDisplay.tsx` — ajouter `riderCount` dans la colonne gauche du `GroupRow`

