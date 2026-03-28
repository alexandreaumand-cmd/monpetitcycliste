

## Fix : extraction des dossards et parsing complet des coureurs PCS

### Problème identifié

Sur PCS, chaque ligne de coureur dans un groupe suit cette structure :
```
[rang dans le groupe] [image maillot] [dossard] [nom] [écart GC]
```
Exemple pour Carapaz : `9 🇪🇨 111 CARAPAZ Richard +1:38`

Le scraper actuel a un bug dans l'extraction des dossards (ligne 196) :
```typescript
const bibMatch = parentText.match(/^\s*(\d{1,3})\s/);
```
Ce regex capture le **premier nombre** du texte parent, qui est le **rang dans le groupe** (1, 2, 3…) et non le **dossard** (14, 32, 111…). Le dossard est le deuxième nombre dans la ligne.

### Solution

Modifier l'extraction du dossard dans `parsePCSLive` pour :

1. **Identifier correctement le dossard** : chercher le nombre qui précède immédiatement le nom du coureur (pas le rang qui est en début de ligne). Le pattern est : `rang` → image/flag → `dossard` → `nom`. On peut extraire le dossard comme le dernier nombre trouvé avant le texte du lien rider.

2. **Regex corrigé** : au lieu de `^\s*(\d{1,3})\s`, chercher le nombre juste avant le nom du coureur dans le texte parent. Pattern : `(\d{1,3})\s+RIDER_NAME` ou extraire tous les nombres et prendre le deuxième (qui est le dossard, le premier étant le rang).

### Changement concret

Dans `supabase/functions/scrape-live-race/index.ts`, lignes 190-201 :

```typescript
// Extract bib: it's the number just before the rider name in the parent text
// Format: "rank [flag] bib RIDER_NAME +GC_gap"
// We need the LAST number before the rider's name, not the first (which is the rank)
const parentText = parentEl.textContent || "";
const riderName = name.split(' ').pop() || name; // Use last name for matching
const beforeName = parentText.substring(0, parentText.indexOf(riderName)).trim();
const allNumbers = beforeName.match(/\d+/g);
if (allNumbers && allNumbers.length >= 2) {
  bib = allNumbers[allNumbers.length - 1]; // Last number before name = bib
} else if (allNumbers && allNumbers.length === 1) {
  bib = allNumbers[0]; // Only one number = likely the bib
}
```

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — lignes 190-201, correction de l'extraction du dossard dans `parsePCSLive`

