

## Plan : Corriger les doublons d'affichage entre phases

### Diagnostic

L'analyse des données en base ne montre aucun doublon au niveau SQL (la vue `bids_outcomes` et les tables `rosters`, `coureurs_saisons` ne contiennent pas de doublons pour la ligue MPC 2026). Le problème est probablement lié au cache React Query qui conserve des données d'une phase précédente lorsque le `phaseId` change, ou à un doublon de rendu côté frontend.

### Correctifs

#### 1. Dédoublonnage défensif dans `RoundHistoryTab.tsx`
Après le fetch des `outcomes` (ligne 35-54), ajouter un dédoublonnage par `bid_id` avant le split won/lost/carried_over :
```typescript
const uniqueOutcomes = outcomes.filter(
  (o, idx, arr) => arr.findIndex(x => x.bid_id === o.bid_id) === idx
);
```
Même chose pour `losersData` (ligne 68-97) : dédoublonner par `coureur_id + manager_id`.

#### 2. Dédoublonnage défensif dans `PhaseRecapTab.tsx`
Après le fetch de `allBids` (ligne 43-57), dédoublonner par `bid_id` pour que les KPIs soient corrects.

#### 3. Dédoublonnage défensif dans `MyBidsList` (via le parent)
Dans `AuctionPageDesktop.tsx` et `AuctionPageMobile.tsx`, la prop `myBids` combine `context.roster` et `context.my_bids`. Ajouter un dédoublonnage par `coureur_id` pour éviter qu'un coureur n'apparaisse en double si le cache retourne des données mixtes entre phases.

#### 4. Dédoublonnage dans `AuctionTeamsGrid.tsx`
Dédoublonner les `allManagersRosters` par `roster.id` après le fetch pour se prémunir contre les doublons liés aux JOINs multiples (losing_bids).

### Impact
- 4 fichiers frontend modifiés
- Aucun changement de base de données
- Fix purement défensif qui n'altère pas le comportement normal

