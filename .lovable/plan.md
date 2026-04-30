## Problème

Quand tu programmes la date/heure d'ouverture des enchères pour la **phase 3** alors que la phase active actuelle est la **phase 2**, l'info ne s'affiche pas sur la carte de la ligue dans le dashboard.

## Cause

Le hook `useLeagueCardsData` (et son équivalent `useLeagueAuctionStatus`) calcule la **phase active** à partir de la date du jour, puis cherche une enchère `scheduled` **uniquement pour cette phase active**.

Code actuel (`src/hooks/useLeagueCardsData.ts`, lignes ~243-305) :

```ts
// Calcule activePhaseId = phase courante (today entre date_debut/date_fin)
// Sinon prochaine phase à venir...

const scheduled = activePhaseId ? leagueAuctions.find(
  a => a.statut === 'scheduled' 
    && a.opens_at 
    && a.opens_at > now 
    && a.phase_id === activePhaseId   // ← bloque les enchères des phases futures
) : null;
```

Vérifié en base TEST : on a bien des enchères `scheduled` pour la phase 3 (par ex. ligue *Early Adopters*, *MPC 2026*, *Tête dans le guidon*) avec `opens_at` en juillet/septembre 2026, mais on est aujourd'hui dans la phase 2 (date_debut 2026-04-XX, date_fin avant le 2026-05-09). Donc ces enchères programmées sont filtrées et n'apparaissent pas sur les cartes.

## Solution

Élargir la recherche d'enchères `scheduled` à **toutes les phases à venir**, pas uniquement la phase active. On garde l'ordre de priorité actuel :

1. Enchère `open` en cours
2. Enchère `closed` avec annonces non publiées (phase active de préférence, sinon n'importe laquelle)
3. **Prochaine enchère `scheduled`** : la plus proche dans le temps (`opens_at > now`), toutes phases confondues
   - Si plusieurs sont programmées, on prend celle dont `opens_at` est le plus tôt

### Fichiers à modifier

1. **`src/hooks/useLeagueCardsData.ts`** (lignes 287-303)
   - Remplacer le filtre `a.phase_id === activePhaseId` par un tri sur `opens_at` croissant et prendre la première
   - Supprimer la condition `activePhaseId ? ... : null` (on cherche même si on n'a pas de phase active)

2. **`src/hooks/useLeagueAuctionStatus.tsx`** (logique étape 3)
   - Appliquer la même correction pour rester cohérent (utilisé dans la barre latérale / autres écrans)
   - Trier `scheduled` par `opens_at` ascendant au lieu de filtrer par `activePhaseId`

### Affichage sur la carte

Aucun changement nécessaire côté UI : la carte affiche déjà correctement le bloc bleu "Programmée" avec :
- Numéro de round
- Compte à rebours `jj : hh : mm : ss` jusqu'à `opens_at`
- Libellé "Ouverture dans"

Une fois la donnée renvoyée, le bloc apparaît automatiquement.

### Cas limite

Si une enchère `scheduled` pour la phase courante existe en plus d'une pour une phase future, on affichera la plus proche dans le temps — ce qui est le comportement attendu (la prochaine étape pour le manager).

## Hors scope

- Pas de changement de schéma DB
- Pas de changement sur la programmation côté admin (qui fonctionne déjà puisque les enchères sont bien créées)
- Pas de changement sur les enchères `open` ni les annonces en attente
