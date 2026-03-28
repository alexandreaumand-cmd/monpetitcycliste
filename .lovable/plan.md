

## Refonte layout RaceSituationDisplay — style PCS avec barres horizontales de séparation

### Layout cible (basé sur l'image PCS)

```text
┌─────────────────────────────────────────┐
│ 1  │ 🏃 21 VINGEGAARD Jonas       +1:13 │
├────┼────────────────────────────────────┤
│    │                                     │
│+0:15  ← écart entre groupe 1 et 2       │
│    │                                     │
├────┼────────────────────────────────────┤
│ 2  │ 🏃 2  LIPOWITZ Florian       +1:13 │
│    │ 🏃 91 MARTINEZ Lenny         +1:09 │
├────┼────────────────────────────────────┤
│+0:25                                     │
├────┼────────────────────────────────────┤
│ 3  │ 🏃 56 PARET-PEINTRE Valentin +1:15 │
└─────────────────────────────────────────┘
```

### Changements

1. **Séparer gap et groupe** : le gap entre deux groupes devient une **ligne de séparation horizontale dédiée** entre les groupes, avec l'écart affiché en gras/couleur à gauche (ex: `+0:15`). Le premier groupe n'a pas de séparateur au-dessus.

2. **Structure du composant** : au lieu de mettre le gap dans la colonne gauche du groupe, on insère un élément séparateur entre chaque groupe :
   - `GapSeparator` : barre horizontale avec l'écart affiché en bleu/primary, fond léger
   - `GroupRow` : badge numéroté à gauche + liste des coureurs à droite (sans le gap)

3. **Badge** reste dans la colonne gauche du groupe (numéro ou P), avec le nombre de coureurs en dessous.

4. **Barre verticale** supprimée — on utilise uniquement des séparations horizontales comme sur PCS.

### Fichier impacté
- `src/components/arena/RaceSituationDisplay.tsx` — refonte du layout avec séparateurs horizontaux entre groupes

