

# Corriger l'indexation des phases : 1-5 au lieu de 0-4

## Problème
Le sélecteur de phase de départ dans `CreateLeagueDialog` utilise des indices 0-4, alors que les phases en base (`index_dans_saison`) sont numérotées de 1 à 5. Cela crée un décalage : sélectionner "Phase 2" envoie `startingPhaseIndex=1` au backend, qui filtre ensuite avec `p.index_dans_saison >= 1` (ce qui inclut la phase 1 au lieu de commencer à la phase 2).

## Modifications

### 1. Frontend — `src/components/leagues/CreateLeagueDialog.tsx`
- Changer l'état initial de `startingPhaseIndex` de `0` à `1`
- Remplacer la liste `[0, 1, 2, 3, 4]` par `[1, 2, 3, 4, 5]` (ou dynamiquement depuis la base, comme prévu dans le plan précédent)
- Adapter l'affichage : la valeur `1` = "Depuis la Phase 1 (défaut)", `2` = "Phase 2", etc.
- Corriger la ligne recap (l.547) qui fait `startingPhaseIndex + 1` → afficher directement `startingPhaseIndex`
- Corriger le reset (`resetForm`) pour remettre à `1` au lieu de `0`

### 2. Backend — `supabase/functions/leagues-create/index.ts`
- Le filtre `p.index_dans_saison >= startingPhaseIndex` fonctionne déjà correctement si le frontend envoie 1-5 (car `index_dans_saison` est aussi 1-5)
- Corriger la sélection de `auctionPhaseId` (l.229-230) : actuellement `phaseUuids[startingPhaseIndex]` utilise l'index comme position dans le tableau filtré, ce qui est faux. Il faut prendre `phaseUuids[0]` (le premier élément du tableau déjà filtré) dans tous les cas

### 3. Vérification des données existantes
- Les 2 ligues existantes ont `starting_phase_index` stocké en base — vérifier si elles utilisent 0-based et si une correction de données est nécessaire

