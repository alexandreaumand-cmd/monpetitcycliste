

## Fix complet : association roster/phase pour les enchères

### Problème élargi

Le plan `effective_phase_id` (figer la phase au round 1) ne couvre pas tous les cas :

| Scénario | Phase au moment du round 1 | Phase souhaitée | Résultat actuel |
|---|---|---|---|
| Enchères MPC P3, le 2 mai | P2 active, P3 scheduled | P3 | ❌ attribue à P2 |
| Nouvelle ligue le 7 mai, veut démarrer P3 | P2 active (fin 8 mai) | P3 | ❌ attribue à P2 |
| Rounds 1 et 2 à cheval sur une transition | P1 completed → P2 active | P2 | ❌ split P1/P2 |

**La résolution dynamique ("prendre la phase active") est fondamentalement fragile.** Il faut que la phase cible soit **décidée à la création de la ligue/enchère**, pas devinée à la clôture.

### Solution révisée

#### 1. À la création de la ligue : le créateur choisit la phase de départ

Le champ `starting_phase_index` existe déjà sur `leagues` mais est toujours `null`. Il faut :
- **UI de création** : ajouter un sélecteur de phase de départ pour les ligues `five_phases` (ex: "Commencer à la Phase 3")
- **`leagues-create`** : utiliser `starting_phase_index` pour déterminer la `phase_id` de la première enchère (au lieu de toujours prendre `phases[0]`)

#### 2. Figer la phase sur l'enchère avec `effective_phase_id`

- **Migration** : `ALTER TABLE auctions ADD COLUMN effective_phase_id uuid REFERENCES phases(id);`
- **Backfill** : `UPDATE auctions SET effective_phase_id = phase_id WHERE effective_phase_id IS NULL;`

#### 3. `leagues-create` : stocker `effective_phase_id` dès la création

```
Si starting_phase_index fourni :
  → phase de départ = phases[starting_phase_index]
Sinon :
  → phase de départ = phases[0] (comme aujourd'hui)

Créer l'auction avec phase_id = phase_départ ET effective_phase_id = phase_départ
```

#### 4. `clore-round` : utiliser `effective_phase_id` sans résolution dynamique

```
effectivePhaseId = auction.effective_phase_id ?? auction.phase_id
// Supprimer toute la logique de résolution dynamique (lignes 117-140)
```

Plus de "si la phase est completed, chercher l'active". La phase est fixée à la source.

#### 5. `ouvrir-nouveau-round` / `publier-annonce` : propager `effective_phase_id`

Quand un nouveau round est créé automatiquement, copier `effective_phase_id` depuis le round précédent.

### Fichiers impactés

1. **Migration SQL** — ajout colonne `effective_phase_id` + backfill
2. `supabase/functions/leagues-create/index.ts` — utiliser `starting_phase_index` pour la phase de départ, stocker `effective_phase_id`
3. `supabase/functions/clore-round/index.ts` — supprimer la résolution dynamique, utiliser `effective_phase_id`
4. `supabase/functions/ouvrir-nouveau-round/index.ts` — propager `effective_phase_id`
5. `supabase/functions/publier-annonce/index.ts` — propager `effective_phase_id`
6. **UI création de ligue** — sélecteur de phase de départ (ligues five_phases)

