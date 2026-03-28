

## Fix : le filtrage `.sit-grp` exclut tous les groupes — 0 top-level trouvé

### Problème racine

Les logs montrent clairement :
```
Found 5 .sit-grp elements
After filtering nested: 0 top-level groups
No .sit-grp found, trying text-based parsing
```

La structure HTML PCS est un conteneur `.sit-grp` qui contient des `.sit-grp` enfants (les vrais groupes). Le filtre actuel cherche des `.sit-grp` **sans aucun ancêtre** `.sit-grp` → seul le conteneur externe passerait, mais il est lui-même le parent, donc les groupes réels (qui ont un parent `.sit-grp`) sont tous exclus.

Le fallback text-based ne capture que les headers de groupe (nom + gap + count) via regex, mais **aucun coureur individuel** — d'où des groupes vides ou mal formés.

### Solution

Remplacer la logique de filtrage par une approche à **deux niveaux** :

1. **Trouver le conteneur racine** : le `.sit-grp` qui n'a **pas** de parent `.sit-grp` (il n'y en a qu'un)
2. **Sélectionner ses enfants directs** `.sit-grp` : ce sont les vrais groupes de course, chacun contenant les riders

```typescript
// Find the root .sit-grp container (the one with no .sit-grp ancestor)
const rootSitGrp = Array.from(allSitGrps).find(el => {
  let parent = el.parentElement;
  while (parent) {
    if (parent.classList?.contains("sit-grp")) return false;
    parent = parent.parentElement;
  }
  return true;
});

// The real groups are the direct .sit-grp children of the root
const sitGroups = rootSitGrp 
  ? Array.from(rootSitGrp.querySelectorAll(":scope > .sit-grp"))
  : [];
```

Si `:scope` n'est pas supporté par le parser HTML (deno-dom), utiliser un fallback :
```typescript
const sitGroups = rootSitGrp
  ? Array.from(rootSitGrp.children).filter(
      (el: any) => el.classList?.contains("sit-grp")
    )
  : [];
```

Cela donnera les vrais groupes (5 dans l'exemple) avec leurs coureurs correctement imbriqués. Le reste du parsing (extraction riders, bibs, GC gaps) reste identique.

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — lignes 130-139, remplacer le filtrage top-level par la sélection des enfants directs du conteneur racine

