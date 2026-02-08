
# Fix: Remplacer le parsing regex par DOMParser (deno-dom)

## Probleme

Le parsing regex dans `parseStartlistByTeamAndRider` retourne systematiquement 0 coureurs sur toutes les pages PCS testees (Provence, Algarve, Figueira). La regex combinee ne matche aucun lien team ni rider dans le HTML recu par l'edge function, bien que le HTML semble correct (39K caracteres, titre extrait correctement).

La fonction `scrape-pcs-results` fonctionne parfaitement car elle utilise `DOMParser` de `deno-dom` pour parser le HTML de maniere fiable.

## Solution

Remplacer le parsing regex par `DOMParser` de `deno-dom`, exactement comme `scrape-pcs-results`.

## Changements dans `supabase/functions/startlist-tracker/index.ts`

### 1. Ajouter l'import DOMParser
```typescript
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
```

### 2. Reecrire `parseStartlistHtml` avec DOMParser
- Parser le HTML complet avec `new DOMParser().parseFromString(html, "text/html")`
- Selectionner la section `ul.startlist_v4`
- Pour chaque equipe : `querySelectorAll("a.team")` pour le nom
- Pour chaque coureur : `querySelectorAll('a[href*="/rider/"]')` pour nom et slug
- Parcourir les elements du DOM sequentiellement (equipe puis coureurs)

### 3. Reecrire `parseChangedRacesHtml` avec DOMParser
- Parser le HTML avec DOMParser
- Trouver les liens de course dans la table via `querySelectorAll('a[href*="/race/"]')`
- Extraire slug et annee depuis le href

### 4. Supprimer les fonctions regex obsoletes
- Supprimer `parseStartlistByTeamAndRider`
- Supprimer `parseStartlistFallback`
- Les remplacer par la logique DOM

## Detail technique

La logique DOM pour les startlists :

```typescript
const doc = new DOMParser().parseFromString(html, "text/html");
const startlist = doc.querySelector(".startlist_v4");
// Iterate through child <li> elements (each = one team)
// Within each: querySelector("a.team") for team name
// querySelectorAll('a[href*="/rider/"]') for riders
```

## Avantage
- Meme approche que `scrape-pcs-results` qui fonctionne parfaitement
- Parsing DOM fiable, insensible a la minification et aux variations d'attributs
- Plus de problemes de regex sur du HTML complexe
