
# Plan combine : Points decimaux TTT + Exclusion du bonus scoreurs

## Resume des modifications

| Modification | Complexite | Impact |
|-------------|-----------|--------|
| Points decimaux pour TTT (2 decimales) | Moyenne | Base de donnees + Fonction SQL + UI |
| Exclure TTT du bonus scoreurs | Faible | Edge Function uniquement |

---

## Partie 1 : Points decimaux pour les resultats TTT

### 1.1 Migration base de donnees

Changer le type de la colonne `points` dans `points_ledger` de `INTEGER` vers `NUMERIC(10,2)`.

```sql
-- Migration: Convertir points_ledger.points en NUMERIC pour supporter les decimales TTT
ALTER TABLE public.points_ledger 
  ALTER COLUMN points TYPE NUMERIC(10,2) USING points::NUMERIC(10,2);

-- Ajouter un commentaire explicatif
COMMENT ON COLUMN public.points_ledger.points IS 
  'Points attribues au coureur. Peut contenir 2 decimales pour les resultats TTT.';
```

### 1.2 Modifier la fonction admin_compute_points_for_course

Remplacer la logique `FLOOR(sr.points / rrs.ttt_riders_count)::integer` par une division decimale arrondie a 2 decimales.

**Changement cle dans la fonction SQL** :
```sql
-- AVANT (actuel)
THEN FLOOR(sr.points::numeric / rrs.ttt_riders_count)::integer

-- APRES (nouveau)
THEN ROUND(sr.points::numeric / rrs.ttt_riders_count, 2)
```

### 1.3 Impact sur l'UI

Les composants qui affichent des points devront gerer les decimales. La plupart utilisent deja `{value} pts` sans formatage strict.

**Fichiers a verifier/adapter** :
| Fichier | Modification |
|---------|--------------|
| `src/components/rankings/ManagerBreakdown.tsx` | Afficher `{detail.points.toFixed(2)} pts` pour les lignes TTT |
| `src/components/rankings/TopRiders.tsx` | Afficher les decimales dans le detail coureur |
| `src/lib/utils.ts` | `formatNumber()` gere deja les decimales |

**Recommandation** : Afficher les decimales uniquement si elles existent (ex: `14.29 pts` pour TTT, `150 pts` pour course normale). La fonction `formatNumber()` existante fait deja cela.

### 1.4 Exemple de resultat

Pour le **Trofeo Ses Salines** (7 coureurs par equipe) :

| Place equipe | Points theoriques | Points par coureur (actuel) | Points par coureur (nouveau) |
|-------------|-------------------|----------------------------|------------------------------|
| 1er | 100 | 14 pts | 14.29 pts |
| 2eme | 85 | 12 pts | 12.14 pts |
| 3eme | 70 | 10 pts | 10.00 pts |

---

## Partie 2 : Exclure les TTT du bonus scoreurs

### 2.1 Modifier l'Edge Function compute-bonus-scoreurs

Le probleme actuel : la requete recupere tous les `coureur_id` ayant des points > 0 sans filtrer les TTT.

**Fichier** : `supabase/functions/compute-bonus-scoreurs/index.ts`

**Changement** (lignes 110-120) :

```typescript
// AVANT (actuel)
const { data: pointsData, error: pointsError } = await supabase
  .from('points_ledger')
  .select('coureur_id')
  .eq('phase_id', phase_id)
  .gt('points', 0);

// APRES (nouveau)
// Utiliser une requete SQL brute via RPC pour exclure les TTT
const { data: pointsData, error: pointsError } = await supabase
  .rpc('get_non_ttt_scoring_riders', { p_phase_id: phase_id });
```

### 2.2 Creer une fonction SQL helper

Nouvelle fonction PostgreSQL pour recuperer les coureurs scoreurs hors TTT :

```sql
CREATE OR REPLACE FUNCTION public.get_non_ttt_scoring_riders(p_phase_id uuid)
RETURNS TABLE(coureur_id text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT pl.coureur_id
  FROM public.points_ledger pl
  LEFT JOIN public.race_result_sets rrs 
    ON rrs.course_id = pl.course_id 
    AND rrs.type_classement = pl.type_classement
    AND COALESCE(rrs.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  WHERE pl.phase_id = p_phase_id
    AND pl.points > 0
    AND COALESCE(rrs.is_ttt, false) = false;
$$;
```

### 2.3 Alternative sans nouvelle fonction RPC

Si on prefere eviter une nouvelle fonction RPC, on peut faire deux requetes dans l'Edge Function :

1. Recuperer tous les `course_id` TTT de la phase depuis `race_result_sets`
2. Exclure ces courses lors de la requete `points_ledger`

```typescript
// 1. Get TTT course/classification combos
const { data: tttResults } = await supabase
  .from('race_result_sets')
  .select('course_id, type_classement, etape_numero')
  .eq('is_ttt', true);

// 2. Build exclusion filter
const tttKeys = new Set(tttResults?.map(r => 
  `${r.course_id}|${r.type_classement}|${r.etape_numero ?? 'null'}`
) || []);

// 3. Query points and filter
const { data: pointsData } = await supabase
  .from('points_ledger')
  .select('coureur_id, course_id, type_classement, etape_numero')
  .eq('phase_id', phase_id)
  .gt('points', 0);

// 4. Filter out TTT points
const nonTttPoints = pointsData?.filter(p => {
  const key = `${p.course_id}|${p.type_classement}|${p.etape_numero ?? 'null'}`;
  return !tttKeys.has(key);
}) || [];

const scoringRiderIds = [...new Set(nonTttPoints.map(p => p.coureur_id).filter(Boolean))];
```

**Recommandation** : L'approche avec fonction RPC est plus propre et performante.

---

## Resume des fichiers a modifier

| Fichier | Modification | Partie |
|---------|--------------|--------|
| Migration SQL (nouvelle) | Changer `points INTEGER` en `NUMERIC(10,2)` | 1 |
| Migration SQL (nouvelle) | Mettre a jour `admin_compute_points_for_course` avec `ROUND(..., 2)` | 1 |
| Migration SQL (nouvelle) | Creer fonction `get_non_ttt_scoring_riders` | 2 |
| `supabase/functions/compute-bonus-scoreurs/index.ts` | Appeler la nouvelle fonction RPC | 2 |
| `src/components/rankings/ManagerBreakdown.tsx` | (Optionnel) Formater decimales TTT | 1 |

---

## Ordre d'execution recommande

1. **Migration 1** : Changer le type de colonne `points_ledger.points`
2. **Migration 2** : Mettre a jour la fonction `admin_compute_points_for_course`
3. **Migration 3** : Creer la fonction `get_non_ttt_scoring_riders`
4. **Edge Function** : Modifier `compute-bonus-scoreurs`
5. **UI** : Ajuster l'affichage des decimales si necessaire
6. **Recalculer les points** pour les courses TTT existantes

---

## Section technique

### Compatibilite ascendante
- Les points existants (entiers) seront automatiquement convertis en `NUMERIC` (ex: `100` devient `100.00`)
- Les requetes existantes continueront de fonctionner car PostgreSQL gere les comparaisons entre `INTEGER` et `NUMERIC`

### Performance
- L'ajout d'une jointure dans `get_non_ttt_scoring_riders` a un impact negligeable car `race_result_sets` est une petite table
- L'index existant sur `points_ledger(phase_id)` reste efficace

### Risques
- **Risque faible** : Certains composants UI pourraient afficher `14.28999...` au lieu de `14.29` - resolu par `toFixed(2)` ou `formatNumber()`
- **Risque nul** : La modification de type `INTEGER -> NUMERIC` est non-destructive

