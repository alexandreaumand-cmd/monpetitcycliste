## Objectif

Dans le mode "À la course" (per_course), le nombre de coureurs à acheter dépend désormais de la nature de la course :

- **Grand Tour** (Tour de France, Giro d'Italia, La Vuelta Ciclista a España) → **15 coureurs / budget 1100**
- **Toute autre course** (stage race non-GT ou one-day) → **10 coureurs / budget 1100**

Le budget reste à 1100 dans les deux cas (choix utilisateur). Les cas "1 one-day = 8/650" et "plusieurs one-day = 10/800" sont supprimés au profit d'une règle unique 10/1100 hors GT.

## Détection des GT

Le champ `wt_tier='GT'` en base est incohérent (utilisé pour plein de courses non-GT). On identifie les GT par **nom de course** :

- `Tour de France`
- `Giro d'Italia`
- `La Vuelta Ciclista a España` (et variantes contenant "vuelta" + "espa")

## Changements de code

1. **`src/lib/leagues/templates.ts`** — réécrire `computePerCourseSettings(courses)` :
   - Ajouter helper `isGrandTour(nom)` (match insensible à la casse).
   - Si au moins une course sélectionnée est un GT → `{ budget: 1100, maxRiders: 15 }`.
   - Sinon → `{ budget: 1100, maxRiders: 10 }`.
   - Adapter la signature pour recevoir `{ nom, type_course }` au lieu de `{ type_course }` seul.

2. **`supabase/functions/leagues-create/index.ts`** (lignes 148-154) — appliquer exactement la même règle côté edge function (sélectionner aussi `nom` dans la requête courses).

3. **Appelants** — mettre à jour pour passer le `nom` :
   - `src/components/leagues/CourseSelector.tsx` (ligne 93)
   - `src/components/leagues/CreateLeagueDialog.tsx` (ligne 146)
   Les deux ont déjà accès au nom dans `selectedCourses` / `selectedCoursesData`.

4. **`src/components/landing/RulesHighlightsSection.tsx`** (ligne 27) — mettre à jour le texte d'aide :  
   « … « À la course » (sélection libre : 10 coureurs / 1100, ou 15 coureurs / 1100 pour un Grand Tour). »

## Correction de la ligue existante

Pour la ligue **"RMC <> La Bordure - Tour AuRA 2026"** (`id = 2bcf9a41-b2a0-41a1-a38e-bb2a38584b67`) :

- Mettre à jour `leagues.settings` : `max_riders` passe de **15 → 10**, budget inchangé à 1100.
- Pas de changement sur les enchères / rosters déjà créés (l'enchère du 03/06 est en attente et lira la nouvelle valeur).

## Hors scope

- Le mode "5 phases" n'est pas modifié.
- Aucun changement de schéma BDD.
- Aucun trigger ajouté : la détection GT est purement applicative.
