

## Incohérence standings vides vs points visibles — ligue "TEST Saison entière 3 managers"

### Cause racine

Deux problèmes combinés :

1. **Le filtre `>` est trop strict pour cette ligue** : `started_at_effective = 2026-03-27` et E3 Saxo Classic a lieu le `2026-03-27`. Avec le filtre `date_debut > started_at_effective`, la course est exclue des standings. Les enchères ont pourtant été fermées le 26 mars (dernier round à 19:17 le 26/03), donc la course DEVRAIT compter.

2. **Les edge functions (get-team-scoring, etc.) n'appliquent pas le même filtre** : elles montrent les points sans vérifier `started_at_effective` avec `>`, d'où des points visibles mais des standings vides.

### Le vrai problème : sémantique de `started_at_effective`

Le code dans `clore-round` fixe `started_at_effective = date du jour + 1` au premier round. Combiné avec le filtre `>` (strict), cela crée une zone morte d'un jour.

| Ligue | Dernier round fermé | started_at_effective | E3 Saxo (27/03) | Filtre `>` | Résultat |
|---|---|---|---|---|---|
| WT sans bonus | 27/03 | 27/03 | 27/03 | `27 > 27` = false | ✅ Correct (exclu) |
| TEST 3 managers | 26/03 | 27/03 | 27/03 | `27 > 27` = false | ❌ Bug (exclu alors que devrait compter) |

### Solution : changer la sémantique de `started_at_effective`

`started_at_effective` doit représenter la **date de clôture du dernier round d'enchères** (pas J+1). Le filtre `>` fera alors le bon travail :

- WT sans bonus : `started_at_effective = 2026-03-27` (fermé le 27) → `27 > 27` = false → E3 exclue ✅
- TEST 3 managers : `started_at_effective = 2026-03-26` (fermé le 26) → `27 > 26` = true → E3 incluse ✅

### Changements

#### 1. Migration SQL — corriger la valeur pour "TEST Saison entière 3 managers"

```sql
UPDATE leagues
SET started_at_effective = '2026-03-26'
WHERE id = 'edb66d34-826e-435b-b033-b70ee36972aa';

SELECT refresh_standings_views();
```

#### 2. `clore-round/index.ts` — ne plus ajouter J+1

Ligne 292-294, remplacer :
```ts
const closedDate = new Date();
closedDate.setDate(closedDate.getDate() + 1);
const effectiveDate = closedDate.toISOString().split('T')[0];
```
Par :
```ts
const effectiveDate = new Date().toISOString().split('T')[0];
```

La date effective devient le jour de clôture, et le filtre `>` exclut naturellement les courses de ce jour.

#### 3. Vérifier les autres ligues existantes

Vérifier si d'autres ligues ont un `started_at_effective` décalé de J+1 et les corriger si nécessaire.

### Fichiers impactés
- **Migration SQL** — correction de `started_at_effective` pour cette ligue + refresh standings
- `supabase/functions/clore-round/index.ts` — supprimer le `+1` jour

