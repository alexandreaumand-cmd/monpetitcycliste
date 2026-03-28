

## Refonte layout RaceSituationDisplay — style PCS fidèle

### Problème actuel

Le composant affiche le badge de groupe à gauche, le nom au centre et l'écart à droite. Sur PCS (image 442), la structure est différente :
- **Colonne gauche** : badge numéroté (1, 2, 3… P) + **écart en dessous du badge**
- **Colonne droite** : nom du groupe en petit (THE BREAKAWAY, PELOTON) puis liste numérotée des coureurs avec dossard

```text
┌──────────────────────────────────────┐
│  🏁 58.6 km restants                │
├──────────────────────────────────────┤
│ ①         THE BREAKAWAY             │
│            1  14  SOLER Marc  +15:43│
│            2  32  CICCONE G.  +9:26 │
│            3  75  SVESTAD...  +19:24│
│            4  111 CARAPAZ R.  +3:55 │
│                                      │
│ ②  +0:15                            │
│            1  222 MUNTON B.   +7:58 │
│                                      │
│ ③  +0:31                            │
│            1  84  DEBRUYNE R. +13:58│
│            2  135 QUINTANA N. +12:55│
│            3  173 HOWSON D.   +33:26│
│                                      │
│ Ⓟ  +1:23  PELOTON                  │
└──────────────────────────────────────┘
```

### Ce qui change

Réécriture du layout de `RaceSituationDisplay.tsx` pour reproduire fidèlement le style PCS :

1. **Badge + écart à gauche** : le badge circulaire numéroté est affiché en haut à gauche, avec l'écart (`+0:15`, `+0:31`…) affiché juste en dessous du badge (pas à droite). Le premier groupe (écart 0:00) n'affiche pas d'écart.

2. **Nom du groupe** en label discret (uppercase, petite taille, couleur muted) au-dessus de la liste des coureurs — affiché uniquement si le groupe a un nom (THE BREAKAWAY, PELOTON).

3. **Liste des coureurs** numérotée dans le groupe : chaque coureur a un numéro d'ordre dans le groupe (1, 2, 3…), le nom complet, et le nom du manager si applicable. Le collapsible au-delà de 5 coureurs reste.

4. **Peloton** : badge "P" avec couleur primary, affiche le nombre de coureurs au lieu de la liste.

### Fichier impacté
- `src/components/arena/RaceSituationDisplay.tsx` — réécriture du layout

