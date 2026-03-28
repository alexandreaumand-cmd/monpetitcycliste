

## Refonte : affichage de la situation de course style PCS

### Problème

L'affichage actuel avec la route horizontale et les emojis de vélos est illisible quand il y a beaucoup de groupes — les labels se chevauchent et les noms sont tronqués.

### Nouveau design (inspiré PCS)

Remplacer la visualisation horizontale par une **liste verticale numérotée** :

```text
┌─────────────────────────────────────────────┐
│ 🏁 60 km restants                           │
├─────────────────────────────────────────────┤
│ ❶  The Breakaway              +0:00         │
│    SOLER Marc          +15:43  🎽 14        │
│    MUNTON Byron         +7:58  🎽 222       │
│                                              │
│ ❷  +0:10                                    │
│    CICCONE Giulio       +9:26  🎽 32        │
│    CARAPAZ Richard      +3:55  🎽 111       │
│                                              │
│ ...                                          │
│ P   Peloton             +1:49                │
│    101 coureurs                              │
└─────────────────────────────────────────────┘
```

Chaque groupe affiche :
- **Numéro de groupe** dans un cercle coloré (1, 2, 3... P pour peloton) sur la gauche
- **Nom du groupe** (si nommé : "The Breakaway", "First chase group") + **écart** sur la droite
- **Liste des coureurs** avec nom + manager (si dans un roster) en dessous, indentée avec une bordure gauche

### Ce qui change

Le composant `RaceSituationDisplay.tsx` est entièrement réécrit :
- Suppression de la route horizontale, des emojis vélos, du positionnement absolu
- Layout vertical en liste, chaque groupe = une rangée avec badge numéroté + gap + coureurs
- Le badge du peloton affiche "P" au lieu d'un numéro
- Les coureurs du roster de la ligue sont mis en valeur (couleur primary, nom du manager)
- Tooltip conservé pour les groupes avec beaucoup de coureurs
- Responsive : fonctionne bien en desktop (panneau latéral 340px) et mobile (accordion)

Le même composant est aussi utilisé dans `MessageBubble` (messages inline) et `SuperAdminLiveBroadcastPage` — le nouveau design vertical sera plus lisible dans tous ces contextes.

### Fichier impacte
- `src/components/arena/RaceSituationDisplay.tsx` — réécriture complète

