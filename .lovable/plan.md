

## Fix : l'éditeur "Situation de course" confond dossards/écarts GC avec nb coureurs/écarts de groupe

### Problème

Deux problèmes distincts dans le scraper PCS (`parsePCSLive`) :

1. **Gap de groupe écrasé par les GC gaps** : la boucle lignes 144-153 parcourt toutes les lignes texte du bloc `.sit-grp` pour trouver le gap. Les écarts GC individuels (+9:26, +15:43) matchent le même pattern `+\d+:\d+` et écrasent `gap` à chaque itération → le gap final est celui du **dernier coureur** (GC), pas le gap du groupe.

2. **riderCount potentiellement pollué** : si le parsing crée des groupes avec un seul coureur (mauvais découpage), le dossard du coureur peut apparaître dans le champ "Nb coureurs" de l'éditeur.

### Solution

#### `supabase/functions/scrape-live-race/index.ts` — `parsePCSLive`

**Gap de groupe** : sur PCS, le gap de groupe est dans un élément distinct (souvent un `<div>` ou `<span>` avec classe spécifique) au niveau du header du groupe, pas mélangé avec les GC gaps des coureurs. Modifier l'extraction :

1. Extraire le gap de groupe **uniquement** depuis les lignes texte **avant** le premier lien rider (le header du groupe contient le nom + gap, les riders viennent après)
2. Ne pas laisser les GC gaps individuels écraser la variable `gap`

```typescript
// Extraire gap uniquement depuis le texte AVANT le premier rider link
const firstLink = grp.querySelector("a[href*='rider/']");
const headerText = firstLink 
  ? grpText.substring(0, grpText.indexOf(firstLink.textContent || ""))
  : grpText;
const headerLines = headerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

for (const line of headerLines) {
  if (/^\+?\d+:\d+/.test(line)) {
    gap = line.startsWith('+') ? line : `+${line}`;
    break; // Prendre le premier match uniquement
  }
  if (!groupName && !/^\d/.test(line) && line.length > 2 && line.length < 60) {
    groupName = line;
  }
}
```

Cela isole le gap de groupe (ex: +1:45) des GC gaps individuels (+9:26, +15:43) qui sont dans le corps du groupe avec les riders.

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — lignes 130-153, extraction du gap de groupe dans `parsePCSLive`

