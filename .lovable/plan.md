## Diagnostic

PCS expose **deux versions** de la startlist pour la même course :

### 1. Page HTML — `…/startlist/startlist` (celle qu'on scrape aujourd'hui)
- Badge affiché : « 79 riders »
- Liens `<a href="rider/…">` dans le DOM : **87**
- UAE listé avec **9 coureurs** (POGAČAR inclus)
- TotalEnergies listé avec **8 coureurs** (BOULAHOITE inclus)
- **Aucun marqueur HTML** ne distingue les 8 extras : tous les `<li class=" ">` sont identiques, pas de classe `reserve`, pas de `style="display:none"`, pas de `data-*`.
- PCS les cache visuellement côté navigateur via JavaScript, à partir d'une source externe qu'on ne voit pas dans le HTML brut.

### 2. PDF officiel — `…/pdf/startlist.php?id=<race_id>`
Vérifié sur `https://www.procyclingstats.com/pdf/startlist.php?id=59839` :
- UAE : Sivakov, Wellens, Oliveira, Del Toro, Torres, Almeida, Vermaerke, Cosnefroy → **8 coureurs, pas de POGAČAR**
- TotalEnergies : Bouchard, Vercher, Le Berre, Jousseaume, Grellier, Breuillard, Jegat → **7 coureurs, pas de BOULAHOITE**
- **Correspond exactement à ta capture d'écran et au compte « 79 riders »**

Le PDF est donc la **source canonique**. La page HTML contient des bruits (joueurs ajoutés à titre spéculatif que PCS n'a pas encore retirés du DOM).

## Correction proposée

**`supabase/functions/startlist-tracker/index.ts`**

Modifier le pipeline de scraping en 3 étapes :

1. **Extraire l'ID PCS de la course** depuis le HTML déjà téléchargé.
   Pattern simple :
   ```ts
   const pcsIdMatch = html.match(/pdf\/startlist\.php\?id=(\d+)/);
   const pcsRaceId = pcsIdMatch?.[1];
   ```

2. **Récupérer la version PDF** quand un ID est trouvé :
   ```ts
   const pdfUrl = `https://www.procyclingstats.com/pdf/startlist.php?id=${pcsRaceId}`;
   const pdfResp = await fetch(pdfUrl, { headers: { "User-Agent": "…" } });
   const pdfText = await pdfResp.text();
   ```

3. **Parser le PDF (en réalité du texte HTML/plain)** : extraire les noms par équipe à partir des lignes type `.. NOM Prénom`, regrouper sous les titres d'équipe numérotés (`1 UAE Team Emirates`, `2 Cofidis`, …).

   Le format est ligne par ligne, équipes en colonnes de 4, riders préfixés par `..`. Cf. la sortie observée :
   ```
   1 UAE Team Emirates  2 TotalEnergies  3 Netcompany INEOS  4 Decathlon CMA CGM Team
   .. SIVAKOV Pavel    .. BOUCHARD Geoffrey  .. THOMAS Benjamin  .. VAUQUELIN Kevin
   …
   ```

4. **Fallback** : si le PDF est indisponible (404, format inattendu, ID introuvable), retomber sur le scraping HTML actuel (comportement présent), avec un log explicite `[FALLBACK] PDF unavailable, using HTML scrape`.

5. **Conserver** la dédup par href slug appliquée précédemment (utile pour le fallback HTML).

## Re-import des données pour AuRA

Après le correctif :
1. Supprimer les entries de l'import actuel `a2661a65-1b59-4b30-9be8-69140de771d6` (87 riders) et l'import lui-même.
2. Reset `last_tracker_check = NULL` sur la course `tour-auvergne-rhone-alpes-mj6w48yf` pour forcer un re-scrape immédiat qui produira les 79 coureurs corrects.

## Hors scope

Pas de modification de `startlist-import` (import de texte collé), pas de changement d'UI, pas de modification de la logique de matching ou de scoring.

## Test de validation

Après déploiement :
1. Le tracker re-scrape AuRA → log `[PDF] Parsed 79 riders from PDF`
2. Vérifier en SQL : `SELECT count(*) FROM startlist_entries WHERE startlist_id = '<new_id>'` → **79**
3. Vérifier l'absence de POGAČAR et BOULAHOITE pour cette course
4. Vérifier qu'une course aux dossards attribués (ex. Heistse Pijl déjà scrapée correctement) continue à fonctionner — le PDF doit aussi rendre les 165 coureurs ; sinon, le fallback HTML prend le relais.
