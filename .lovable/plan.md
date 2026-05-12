## Diagnostic confirmé

J'ai vérifié les données LIVE :
- 1189 pronostics au total, dont 1120 évalués.
- La somme des `total_count` affichés dans ton classement (179 + 189 + 173 + 174 + 165 + 106 + 13 + 1) = **exactement 1000**.

➡️ La version déployée en LIVE de l'edge function `arena-pronostic-standings` lit `arena_pronostics` sans pagination, et PostgREST coupe à 1000 lignes. La version paginée existe dans le repo mais elle n'est pas en LIVE (publication bloquée).

Une simple requête `UPDATE` ne corrigera rien : les pronostics sont bien évalués en base, c'est l'agrégation qui est tronquée à la lecture.

## Solution

Déplacer l'agrégation côté Postgres via une RPC `SECURITY DEFINER`. Avantages :
- La RPC renvoie au maximum 1 ligne par manager (≤ quelques dizaines), donc le cap de 1000 ne s'applique plus.
- Pas besoin que l'edge function soit re-déployée : la RPC est appelable directement depuis le client Supabase, et est exposée dès la création (pas besoin de publish DB côté Lovable, les migrations s'appliquent à LIVE au publish, mais la migration peut aussi être exécutée manuellement en LIVE via le SQL Runner si le publish reste bloqué).

### Étape 1 — Créer la RPC (migration)

```sql
CREATE OR REPLACE FUNCTION public.get_arena_pronostic_standings(p_league_id uuid)
RETURNS TABLE (
  manager_id uuid,
  manager_nom text,
  avatar_url text,
  correct_count bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      ap.manager_id,
      COUNT(*) FILTER (WHERE ap.is_correct = true) AS correct_count,
      COUNT(*) AS total_count
    FROM public.arena_pronostics ap
    WHERE ap.league_id = p_league_id
      AND ap.is_correct IS NOT NULL
    GROUP BY ap.manager_id
  )
  SELECT
    a.manager_id,
    COALESCE(m.nom, 'Inconnu') AS manager_nom,
    m.avatar_url,
    a.correct_count,
    a.total_count
  FROM agg a
  LEFT JOIN public.managers m ON m.id = a.manager_id
  WHERE EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = p_league_id
      AND lm.user_id = auth.uid()
  )
  ORDER BY a.correct_count DESC, a.total_count ASC;
$$;

REVOKE ALL ON FUNCTION public.get_arena_pronostic_standings(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_arena_pronostic_standings(uuid) TO authenticated;
```

Le contrôle d'appartenance à la ligue (`EXISTS … league_members`) reproduit la sécurité que faisait l'edge function.

### Étape 2 — Brancher le hook sur la RPC

Dans `src/hooks/useArenaPronostics.ts`, remplacer l'appel `supabase.functions.invoke('arena-pronostic-standings', …)` par :

```ts
const { data, error } = await supabase.rpc('get_arena_pronostic_standings', {
  p_league_id: leagueId,
});
if (error) throw error;
return (data ?? []) as StandingsEntry[];
```

Le shape retourné correspond déjà à `StandingsEntry`, donc aucun changement dans `PronosticStandings.tsx`.

### Étape 3 — Déploiement en LIVE

- Si la publication fonctionne à nouveau (ticket support TEST/LIVE résolu) : un publish suffit, la migration et le hook partent ensemble.
- Si la publication reste bloquée : exécuter le SQL de l'étape 1 directement dans le **SQL Runner Cloud** en sélectionnant l'environnement **LIVE**. Le hook frontend, lui, ne pourra être livré qu'au prochain publish — mais la RPC créée à l'avance ne casse rien et sera utilisée dès que le front sera publié.

## Notes

- Pas besoin de toucher aux pronostics existants (`UPDATE`) : les 1120 lignes évaluées sont correctes, c'est uniquement la lecture qui était tronquée.
- Les 69 pronostics restants (`is_correct IS NULL`) correspondent à des courses non encore évaluées et seront pris en compte automatiquement quand `arena-evaluate-pronostics` tournera sur ces courses.
- La RPC remplace fonctionnellement l'edge function `arena-pronostic-standings` ; on pourra la supprimer plus tard pour libérer un slot (114/130 utilisés).
