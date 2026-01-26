
## Diagnostic

L'erreur "there is no unique or exclusion constraint matching the ON CONFLICT specification" provient de la fonction Edge `rate-managers` qui tente un `UPSERT` avec :
```typescript
onConflict: 'league_id,race_id'
```

Mais cette contrainte unique **n'existe pas** dans la table `league_startlist_notes`.

### État actuel de la table

| Colonne | Nullable | Contrainte |
|---------|----------|------------|
| `id` | NO | PRIMARY KEY |
| `league_id` | NO | - |
| `startlist_id` | NO | - |
| `race_id` | YES | - |

**Problème** : `race_id` est nullable, ce qui empêche de créer une contrainte unique standard.

## Solution

### Étape 1 : Migration de base de données

```sql
-- 1. Mettre à jour les race_id manquants depuis startlist_imports
UPDATE league_startlist_notes lsn
SET race_id = si.race_id
FROM startlist_imports si
WHERE lsn.startlist_id = si.id
  AND lsn.race_id IS NULL;

-- 2. Rendre race_id NOT NULL (après mise à jour des données)
ALTER TABLE league_startlist_notes
ALTER COLUMN race_id SET NOT NULL;

-- 3. Supprimer les doublons potentiels avant d'ajouter la contrainte
DELETE FROM league_startlist_notes a
USING league_startlist_notes b
WHERE a.id < b.id
  AND a.league_id = b.league_id
  AND a.race_id = b.race_id;

-- 4. Ajouter la contrainte unique
ALTER TABLE league_startlist_notes
ADD CONSTRAINT league_startlist_notes_league_race_unique 
UNIQUE (league_id, race_id);
```

### Étape 2 : Aucun changement de code requis

La fonction `rate-managers` est déjà correctement codée avec `onConflict: 'league_id,race_id'`. Une fois la contrainte créée, elle fonctionnera.

## Résumé des modifications

| Type | Fichier/Table | Action |
|------|---------------|--------|
| DB | `league_startlist_notes` | Migrer les `race_id` manquants |
| DB | `league_startlist_notes` | Rendre `race_id` NOT NULL |
| DB | `league_startlist_notes` | Ajouter contrainte UNIQUE sur `(league_id, race_id)` |

## Risque

Faible - La table semble contenir peu de données et la migration met à jour les valeurs manquantes avant d'appliquer les contraintes.
