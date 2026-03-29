

## Fix : le scraper PCS ne détecte pas les coureurs dans les groupes

### Cause racine

Les logs montrent clairement :
```
Found 0 .sit-grp elements
Root container found: false, direct .sit-grp children: 0
No .sit-grp found, trying text-based parsing
Total: 2 groups, 0 riders, 113 PCS slugs
```

Le parser DOM cherche des éléments `.sit-grp` mais `deno-dom` (parser HTML léger côté serveur) ne les trouve pas — probablement parce que PCS charge la section "Situation" dynamiquement via JavaScript, ou que le HTML statique utilise une structure différente de celle attendue.

**Cependant**, les 113 liens de coureurs (`a[href*='rider/']`) SONT bien dans le HTML statique. Le fallback texte (lignes 260-296) trouve bien 2 groupes ("The Breakaway" + "Peloton") mais crée des groupes avec `riders: []` — il ne rattache **aucun coureur** aux groupes.

### Solution

Réécrire le fallback texte pour qu'il extraie aussi les coureurs de chaque groupe en exploitant les liens rider déjà présents dans le HTML.

### Approche technique

Dans `parsePCSLive()`, quand `sitGroups.length === 0` (pas de `.sit-grp` DOM), le fallback doit :

1. **Trouver la section "Situation"** dans le texte brut (déjà fait)
2. **Identifier les groupes** par le pattern texte (déjà fait, regex `groupRx`)
3. **NOUVEAU : Rattacher les coureurs aux groupes** en utilisant les liens `a[href*='rider/']` qui sont dans la zone "Situation" du DOM

Concrètement :
- Chercher un conteneur DOM parent de la section Situation (ex: `h3` ou `div` contenant "Situation")
- Depuis ce conteneur, extraire les liens rider dans l'ordre du DOM
- Les répartir entre les groupes trouvés en se basant sur la position dans le texte (les riders entre le groupe N et le groupe N+1 appartiennent au groupe N)
- Pour chaque rider : extraire le nom depuis le lien, le bib depuis le texte parent, le slug PCS depuis le href

4. **Fallback ultime** : si même le DOM parent n'est pas trouvable, parser le texte plat avec une regex pour trouver les lignes `N  BIB  NOM Prénom` entre les marqueurs de groupe

### Changement concret

Dans `supabase/functions/scrape-live-race/index.ts`, remplacer le bloc fallback (lignes 260-296) par une version enrichie qui :
- Localise le nœud DOM contenant "Situation" (ex: `h3`, `.w68`, ou le parent commun des rider links dans la zone)
- Itère sur les `<li>` ou éléments structurés sous chaque groupe pour extraire rank, bib, rider link
- Peuple `riders`, `riderBibs`, `riderGcGaps` dans chaque groupe

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — réécriture du fallback texte dans `parsePCSLive()` pour extraire les coureurs

