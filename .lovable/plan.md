

## Ajouter les dossards et écarts GC par coureur (style PCS fidèle)

### Contexte

L'image PCS montre pour chaque coureur dans un groupe : **rang**, **dossard**, **drapeau**, **nom**, et **écart au classement général** à droite (+15:43, +9:26…). Actuellement, le scraper n'extrait ni les dossards ni les écarts GC individuels — seul le gap entre groupes est capturé.

Le layout actuel (gap de groupe sous le badge à gauche) est correct. Il manque les données par coureur.

### Ce qui change

#### 1. Scraper PCS — extraire dossard + GC gap par coureur

Dans `supabase/functions/scrape-live-race/index.ts`, fonction `parsePCSLive` :
- Chaque ligne coureur dans `.sit-grp` contient le **dossard** (dans un span avant le lien) et l'**écart GC** (texte après le lien, format `+MM:SS`)
- Ajouter l'extraction de ces 2 champs pour chaque coureur
- Les stocker dans les données de situation : `riders` devient un tableau d'objets `{ name, bib, gcGap, pcsSlug }` au lieu de simples strings

#### 2. Interface RaceGroup — enrichir le modèle

Dans `RaceSituationDisplay.tsx`, enrichir l'interface :
- `riders` passe de `string[]` à `{ name: string; bib?: string; gcGap?: string }[]` (ou garder `string[]` pour les noms et ajouter `riderBibs?: string[]` et `riderGcGaps?: string[]` pour compatibilité)

Approche retenue : ajouter `riderBibs?: string[]` et `riderGcGaps?: string[]` à `RaceGroup` pour ne pas casser les sources existantes (L'Equipe n'a pas ces infos).

#### 3. Affichage — ajouter dossard et GC gap dans RiderRow

Chaque ligne coureur affichera :
```text
1  14  SOLER Marc  (manager)  +15:43
```
- Rang (déjà présent)
- Dossard (nouveau, petit texte muted)
- Nom (déjà présent, highlight si manager)
- GC gap à droite (nouveau, aligné à droite, font-mono)

Le dossard et le GC gap ne s'affichent que si les données existent (optionnels).

### Fichiers impactés
- `supabase/functions/scrape-live-race/index.ts` — extraction dossard + GC gap dans `parsePCSLive`
- `src/components/arena/RaceSituationDisplay.tsx` — interface enrichie + affichage dossard/GC gap dans `RiderRow`

