

## Fix : les enchères assignent les rosters à la mauvaise phase

### Problème

Dans "TEST Saison entière 3 managers", les 4 rounds d'enchères sont liés à la **phase 1** (terminée le 21 mars), mais ont été clôturés les 25-26 mars — donc **pendant la phase 2** (22 mars - 8 mai). Résultat : les 90 rosters créés ont `phase_id` = phase 1 au lieu de phase 2.

### Cause racine

Quand une ligue est créée (`leagues-create/index.ts` ligne 231-252), l'enchère est associée à `firstPhaseId`. Quand `clore-round` ferme un round et ouvre le suivant, le nouveau round hérite du même `phase_id` (celui de l'enchère précédente). Il n'y a **aucun mécanisme** pour basculer vers la phase courante quand la phase initiale est terminée.

### Solution en 2 parties

#### 1. Fix des données existantes (one-shot)

Mettre à jour les 90 rosters et les 4 auctions pour pointer vers la phase 2 (`8b939cb8-...`), qui est la phase active au moment où les enchères ont réellement eu lieu.

#### 2. Fix du code — `clore-round/index.ts`

Quand `clore-round` crée une entrée roster (ligne 168), au lieu d'utiliser `auction.phase_id` directement, **déterminer la phase active** à la date courante :

```typescript
// Determine the correct phase: use the currently active phase if auction's phase is completed
let effectivePhaseId = auction.phase_id;

const { data: auctionPhase } = await supabase
  .from('phases')
  .select('statut, saison_id')
  .eq('id', auction.phase_id)
  .single();

if (auctionPhase?.statut === 'completed') {
  const { data: activePhase } = await supabase
    .from('phases')
    .select('id')
    .eq('saison_id', auctionPhase.saison_id)
    .eq('statut', 'active')
    .single();
  
  if (activePhase) {
    effectivePhaseId = activePhase.id;
  }
}

// Use effectivePhaseId for roster insert
await supabase.from('rosters').insert({
  phase_id: effectivePhaseId,
  ...
});
```

De même, quand un **nouveau round** est ouvert après clôture (vers la fin de `clore-round`), utiliser `effectivePhaseId` pour la nouvelle enchère.

#### 3. Fix des données — migration SQL

```sql
-- Move rosters from phase 1 to phase 2 for this league
UPDATE rosters 
SET phase_id = '8b939cb8-7079-4938-ba00-920603813092'
WHERE phase_id = '73e540d2-d008-4d13-ac93-72aec3d5d986'
  AND league_id = (SELECT id FROM leagues WHERE name ILIKE '%TEST Saison%3%' LIMIT 1);

-- Update auctions too
UPDATE auctions
SET phase_id = '8b939cb8-7079-4938-ba00-920603813092'
WHERE phase_id = '73e540d2-d008-4d13-ac93-72aec3d5d986'
  AND league_id = (SELECT id FROM leagues WHERE name ILIKE '%TEST Saison%3%' LIMIT 1);
```

Puis rafraîchir les vues matérialisées standings.

### Fichiers impactés
- `supabase/functions/clore-round/index.ts` — détection phase active pour roster + nouveau round
- Data fix via l'outil insert (rosters + auctions de la ligue TEST)
- Refresh standings views après le fix data

