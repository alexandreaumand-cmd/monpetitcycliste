

## Améliorations visuelles du RaceSituationDisplay

### Changements demandés

1. **Police plus grande** : passer les tailles de texte de `text-[11px]`/`text-[9px]` à `text-xs`/`text-[11px]` pour une meilleure lisibilité
2. **Barre verticale entre groupes** : ajouter un trait vertical coloré (`border-l-2`) à gauche de chaque groupe pour séparer visuellement les sections
3. **Coureur manquant** : c'est un bug scraper — le rider "SVESTAD-BÅRDSENG Embret" est probablement filtré par la condition `name.length >= 3` ou la regex de parsing. Vérifier le parsing PCS des noms avec caractères spéciaux (å, ø, etc.)
4. **"(-)" pour coureurs sans manager** : ajouter `(-)` après le nom si le coureur n'a pas de propriétaire dans le roster
5. **Peloton** : afficher le texte "PELOTON" en label et l'écart du peloton sous le badge "P"

### Détails techniques

#### `src/components/arena/RaceSituationDisplay.tsx`

- **Layout GroupRow** : envelopper chaque groupe dans un conteneur avec `border-l-2 border-primary/30 pl-2` (ou `border-primary` pour le peloton) pour créer la barre verticale
- **Tailles de police** : 
  - Badge : `w-7 h-7 text-xs` (au lieu de `w-6 h-6 text-[10px]`)
  - Nom du groupe : `text-[10px]` (au lieu de `text-[9px]`)
  - Coureurs : `text-xs` (au lieu de `text-[11px]`)
  - Dossards : `text-[10px]` (au lieu de `text-[9px]`)
  - GC gap : `text-[10px]` (au lieu de `text-[9px]`)
  - Gap de groupe : `text-[10px]` (au lieu de `text-[9px]`)
- **RiderRow** : si `ownerName` est undefined/falsy, afficher `(-)` à la place (même style muted que le nom de manager)
- **Peloton** : toujours afficher le label "PELOTON" et montrer l'écart (ne plus masquer le gap pour le peloton)

#### `supabase/functions/scrape-live-race/index.ts`

Le coureur manquant est probablement lié à la condition de parsing du nom ou au traitement des caractères spéciaux dans `parsePCSLive`. Vérifier que :
- Les noms avec des caractères nordiques (å, ø, æ, etc.) ne sont pas filtrés
- Le `fullText.replace(lastName, "")` fonctionne bien avec ces caractères
- Le rider n'est pas exclu par un filtre de longueur ou de format

### Fichiers impactés
- `src/components/arena/RaceSituationDisplay.tsx` — refonte visuelle (tailles, barre verticale, `(-)`)
- `supabase/functions/scrape-live-race/index.ts` — vérifier parsing noms spéciaux

