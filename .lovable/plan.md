## Cause

Le scraping PCS dans `supabase/functions/startlist-tracker/index.ts` (`parseStartlistHtml`, ligne ~1054) déduplique les coureurs par numéro de dossard à l'intérieur d'une équipe :

```ts
if (bib && seenBibs.has(bib)) {
  filteredReserves.push(...);
  continue;
}
if (bib) seenBibs.add(bib);
```

Cette logique sert à filtrer les remplaçants d'une startlist préliminaire (titulaire + réserve sur le même dossard). Mais sur PCS, quand les dossards ne sont pas encore attribués, **tous les coureurs ont `bib = "-"`** (placeholder). Exemple TotalEnergies sur la page AuRA :

```html
<li><span class="bib">-</span><a href="rider/geoffrey-bouchard">BOUCHARD Geoffrey</a></li>
<li><span class="bib">-</span><a href="rider/matheo-vercher">VERCHER Mattéo</a></li>
<li><span class="bib">-</span><a href="rider/mathis-le-berre">LE BERRE Mathis</a></li>
... (7 coureurs au total)
```

Comme `"-"` est truthy, le premier coureur ajoute `"-"` à `seenBibs` et **tous les autres sont éjectés comme « reserves »**. D'où 1 coureur par équipe au lieu de 7-8 pour les équipes dont les dossards ne sont pas figés. Cela explique les 65/79 et les équipes truncated dans la table `startlist_entries`.

(Les 2 entrées Bouchard viennent probablement d'un double passage du tracker — un seul restera après le re-scrape.)

## Correction

**`supabase/functions/startlist-tracker/index.ts` — `parseStartlistHtml`**

Remplacer la dédup naïve par dossard par une dédup qui :
1. Ignore les valeurs placeholder (`"-"`, vide, `"?"`, non numériques) — on ne déduplique que sur des dossards réellement numériques.
2. Pour les startlists sans dossards attribués, déduplique par **nom de coureur** (via le href `rider/<slug>` qui est unique) pour éviter d'introduire des doublons accidentels.

Pseudocode du bloc modifié :

```ts
const isRealBib = bib && /^\d+$/.test(bib);
const riderKey = riderLink.getAttribute("href") || riderName;

if (isRealBib && seenBibs.has(bib)) {
  filteredReserves.push({ name: riderName, bib, team: teamName });
  continue;
}
if (seenRiders.has(riderKey)) continue; // doublon exact dans la même équipe
if (isRealBib) seenBibs.add(bib);
seenRiders.add(riderKey);
```

Le log `[DEDUPE]` reste pour traçabilité.

## Re-import des données existantes pour la course AuRA

Après le correctif :
1. Supprimer les 2 entrées erronées (`startlist_entries` du startlist_id `f9bd123b-...`) ou supprimer l'import lui-même.
2. Laisser le `startlist-tracker` re-scraper automatiquement (ou déclencher manuellement) pour repeupler avec les ~79 coureurs réels.

## Aucune autre modification

`startlist-import` (parsing texte collé) n'est pas touché — le bug est uniquement côté scraper PCS HTML.
