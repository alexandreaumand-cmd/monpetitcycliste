

## Probleme identifie

L'ecran "Mon Equipe" calcule les scoreurs differemment de l'ecran "Classement" :

- **Classement** (correct) : compte les coureurs distincts ayant marque des points (`points > 0`) en **excluant les resultats TTT** (`is_ttt = false`), via la table `race_result_sets`
- **Mon Equipe** (incorrect) : compte simplement les coureurs avec `points_total > 0` sur le roster, ce qui inclut les points TTT

## Solution

Modifier la fonction backend `manager-my-team` pour aligner le calcul des scoreurs avec la vue `v_manager_standings_by_phase_v2`.

### Changement technique

**Fichier** : `supabase/functions/manager-my-team/index.ts`

Remplacer le calcul simple a la ligne 214 :
```typescript
const scorersCount = visibleCoureurs.filter((c: any) => Number(c.points_total || 0) > 0).length || 0;
```

Par une requete SQL qui reproduit exactement la logique de la vue du classement :
1. Interroger `points_ledger` pour les coureurs du roster sur la phase
2. Faire un `LEFT JOIN` avec `race_result_sets` pour identifier les resultats TTT
3. Filtrer `points > 0` et `is_ttt = false`
4. Compter les `DISTINCT coureur_id`

Concretement, ajouter une requete RPC ou directe qui :
- Prend les `coureur_id` du roster visible
- Cherche dans `points_ledger` les points > 0 pour la phase
- Exclut les lignes ou `race_result_sets.is_ttt = true`
- Retourne le `COUNT(DISTINCT coureur_id)`

