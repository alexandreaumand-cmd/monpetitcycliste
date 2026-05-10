## Cause racine

L'edge function `arena-pronostic-standings` charge **toutes** les lignes évaluées de `arena_pronostics` côté JS, puis agrège en mémoire :

```ts
const { data: pronostics } = await adminClient
  .from('arena_pronostics')
  .select('manager_id, is_correct')
  .eq('league_id', league_id)
  .not('is_correct', 'is', null);
```

Or, le client Supabase impose une **limite par défaut de 1000 lignes** par `select`. Pour la ligue MPC 2026, le total de pronostics évalués atteint déjà **1065 lignes** (Ludo 201 + Matt L 192 + Matt B 185 + Fab 184 + Bubu 173 + Manou 106 + Alex 14 + JP 6 + Max 4).

Conséquences exactement cohérentes avec ce que tu observes :
- Les ~65 lignes les plus récentes sont coupées → les nouveaux pronostics évalués (récemment évalués pour Matt L, Ludo, Matt B, Fab… + **les 6 lignes de JP**) sont ignorées.
- Le classement reste figé sur l'état "ancien" (~1000 premières lignes par ordre interne).
- JP, n'ayant que des lignes très récentes, **disparaît totalement** de l'agrégation côté JS — donc absent du classement.

C'est aussi pourquoi le problème ne se manifeste que maintenant : on vient de franchir le seuil des 1000 lignes pour cette ligue.

## Correctif proposé

Faire l'agrégation côté DB plutôt que de tout rapatrier. Deux options :

### Option A — Pagination dans l'edge function (rapide, minimal)
Boucler sur des `range(offset, offset+999)` jusqu'à épuisement avant d'agréger. Pas de migration SQL, juste un patch de l'edge function.

```ts
const PAGE = 1000;
let from = 0;
const all: { manager_id: string; is_correct: boolean }[] = [];
while (true) {
  const { data, error } = await adminClient
    .from('arena_pronostics')
    .select('manager_id, is_correct')
    .eq('league_id', league_id)
    .not('is_correct', 'is', null)
    .range(from, from + PAGE - 1);
  if (error) throw error;
  all.push(...(data ?? []));
  if (!data || data.length < PAGE) break;
  from += PAGE;
}
```

Puis l'agrégation existante par manager continue de fonctionner. Aucun changement côté front.

### Option B — RPC d'agrégation (propre, scalable)
Créer une fonction SQL `get_pronostic_standings(p_league_id uuid)` qui renvoie directement `(manager_id, correct_count, total_count)` agrégés. L'edge function se contente d'appeler la RPC + de joindre les noms/avatars des managers. Pas de risque de seuil, perf bien meilleure.

**Recommandation : Option A** pour résoudre le bug immédiatement (1 seul fichier modifié, déploiement immédiat), puis Option B comme amélioration ultérieure si tu veux.

## Étapes (Option A)

1. Modifier `supabase/functions/arena-pronostic-standings/index.ts` pour paginer le `select` sur `arena_pronostics`.
2. Déployer l'edge function (auto).
3. Vérifier en LIVE : Matt L doit toujours être à 59, et JP doit apparaître avec 1/6.
4. Inviter à invalider la query côté UI (ou attendre 2 min de staleTime / refresh).

Aucune migration SQL n'est nécessaire pour ce correctif.