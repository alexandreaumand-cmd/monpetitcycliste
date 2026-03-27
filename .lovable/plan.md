

## Diagnostic et fix : ligue "Ligue Publique WT sans bonus"

### Deux problèmes identifiés

#### 1. Coureurs sur la mauvaise phase (même bug que précédemment)

Les rounds 1 et 2 ont été clôturés le 26 mars — **avant le déploiement du fix `effectivePhaseId`** (27 mars). Seul le round 3 (clôturé le 27 mars après le fix) a correctement assigné ses rosters à la phase 2.

Résultat actuel :
- **Phase 1** (terminée 21/03) : 81 rosters (26 Ludo + 25 Alex + 30 LudoTEST10)
- **Phase 2** (active) : 8 rosters (4 Ludo + 4 Alex)

Tous ces rosters devraient être en phase 2 car toutes les enchères ont eu lieu après la fin de la phase 1.

**Fix** : migration SQL pour déplacer les 81 rosters de phase 1 vers phase 2, + mettre à jour le `phase_id` des 4 auctions.

#### 2. Round 4 ouvert alors que Ludo a 30 coureurs

Ludo et LudoTEST10 ont déjà atteint le max de 30 coureurs. Seul Alex (29 coureurs) a encore besoin d'enchérir — il a d'ailleurs 5 bids pending sur le round 4.

Le round 4 est techniquement correct (Alex en a besoin), mais Ludo voit ce round ouvert et c'est déroutant. Ce n'est pas un bug — le système ouvre un round tant que des bids `carried_over` ou des managers incomplets existent. Ludo n'est pas obligé de miser.

Toutefois, si tous les managers ont atteint leur quota, le round ne devrait pas se créer automatiquement. Ce serait une amélioration future.

### Solution proposée

#### Migration SQL (one-shot)
```sql
-- Déplacer les rosters de phase 1 vers phase 2
UPDATE rosters 
SET phase_id = '8b939cb8-7079-4938-ba00-920603813092'
WHERE phase_id = '73e540d2-d008-4d13-ac93-72aec3d5d986'
  AND league_id = '369be846-0afb-4aaf-a685-fd90771d2fd3';

-- Mettre à jour les auctions aussi
UPDATE auctions
SET phase_id = '8b939cb8-7079-4938-ba00-920603813092'
WHERE phase_id = '73e540d2-d008-4d13-ac93-72aec3d5d986'
  AND league_id = '369be846-0afb-4aaf-a685-fd90771d2fd3';

-- Refresh standings
SELECT refresh_standings_views();
```

#### Pas de changement de code
Le fix `effectivePhaseId` déployé précédemment empêchera ce problème pour les futurs rounds. Le round 4 ouvert est normal — Alex a besoin de compléter son effectif.

### Fichier impacté
- **Migration SQL** — correction des données de cette ligue uniquement

