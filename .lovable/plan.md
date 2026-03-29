

## Fix : coureurs dupliqués entre groupes dans le scraper PCS Live

### Cause racine

Dans `parsePCSLive()` (ligne 180), chaque groupe extrait ses coureurs avec :
```typescript
const riderLinks = grp.querySelectorAll("a[href*='rider/']");
```

`querySelectorAll` est **récursif** — il descend dans les `.sit-grp` enfants imbriqués. Résultat : le groupe parent (ex: "Early Breakaway") récupère aussi les coureurs des sous-groupes (ex: "Group Magnier"), d'où la duplication.

### Solution

Filtrer les rider links pour exclure ceux qui appartiennent à un `.sit-grp` enfant imbriqué. Pour chaque `<a>` trouvé, vérifier que son ancêtre `.sit-grp` le plus proche est bien le groupe courant (et non un sous-groupe).

### Changement dans `supabase/functions/scrape-live-race/index.ts`

**Ligne 180-181** — remplacer l'extraction directe par un filtrage :

```typescript
const allRiderLinksInGroup = grp.querySelectorAll("a[href*='rider/']");
// Filter out links that belong to nested .sit-grp children
const nestedSitGrps = new Set(Array.from(grp.querySelectorAll(".sit-grp")));
const riderLinks = Array.from(allRiderLinksInGroup).filter((link: any) => {
  let parent = link.parentElement;
  while (parent && parent !== grp) {
    if (nestedSitGrps.has(parent)) return false; // belongs to a nested sub-group
    parent = parent.parentElement;
  }
  return true;
});
```

Cela garantit que chaque coureur n'apparaît que dans son groupe direct, sans duplication.

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — filtrage des rider links imbriqués

