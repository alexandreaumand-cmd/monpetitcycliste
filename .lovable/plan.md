

## Fix : regrouper correctement les coureurs par groupe dans le scraper PCS

### Problème

Le scraper PCS utilise `doc.querySelectorAll(".sit-grp")` qui retourne **tous** les éléments avec cette classe, y compris ceux imbriqués (les lignes de coureurs individuels). Résultat : au lieu de 3-4 groupes (7 coureurs, 4 coureurs, 3 coureurs, peloton), le scraper crée un "groupe" par coureur avec le GC gap individuel comme écart de groupe.

### Cause racine

PCS utilise `.sit-grp` à **deux niveaux** :
- Au niveau groupe (The Breakaway, Group of Favorites, Peloton)
- Au niveau coureur individuel (imbriqué dans le groupe parent)

`querySelectorAll` retourne les deux niveaux à plat, et le scraper traite chaque élément comme un groupe distinct.

### Solution en 2 étapes

#### 1. Filtrer les `.sit-grp` imbriqués (scraper)

Dans `parsePCSLive`, après le `querySelectorAll(".sit-grp")`, ne garder que les éléments **top-level** — ceux qui n'ont pas de parent `.sit-grp` :

```typescript
const allSitGrps = doc.querySelectorAll(".sit-grp");
const topLevelGrps = Array.from(allSitGrps).filter(el => {
  let parent = el.parentElement;
  while (parent) {
    if (parent.classList?.contains("sit-grp")) return false;
    parent = parent.parentElement;
  }
  return true;
});
```

#### 2. Post-processing de sécurité

Après la boucle de parsing, ajouter une étape de fusion : si un groupe n'a **qu'un seul coureur**, pas de nom de groupe explicite (ou le nom = le nom du coureur), et que le groupe précédent n'est pas un peloton, fusionner ce coureur dans le groupe précédent. Cela protège contre les cas où le filtrage de niveau 1 ne suffit pas.

```typescript
// Post-process: merge orphan single-rider groups into previous group
const merged: typeof situationGroups = [];
for (const g of situationGroups) {
  const isOrphan = g.riders.length <= 1 
    && !g.isPeloton 
    && !isGroupName(g.name); // e.g. not "The Breakaway", "Group of favorites"
  if (isOrphan && merged.length > 0 && !merged[merged.length-1].isPeloton) {
    const prev = merged[merged.length-1];
    prev.riders.push(...g.riders);
    prev.riderBibs?.push(...(g.riderBibs || []));
    prev.riderGcGaps?.push(...(g.riderGcGaps || []));
    prev.riderCount = prev.riders.length;
  } else {
    merged.push(g);
  }
}
```

Avec une heuristique `isGroupName` qui reconnaît les vrais noms de groupe : contient "breakaway", "chase", "peloton", "group", "favourites/favorites", ou commence par une majuscule avec plus de 2 mots.

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — filtrage des `.sit-grp` imbriqués + post-processing de fusion dans `parsePCSLive`

