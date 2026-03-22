

# Fix: Équipes confirmées non affichées — limite 1000 lignes

## Diagnostic

La requête ligne 165-168 de `CalendarPage.tsx` charge **toutes les `startlist_entries`** pour tous les imports de la saison en une seule requête :

```typescript
const { data: entries } = await supabase
  .from("startlist_entries")
  .select("startlist_id, source_team, team_confirmed")
  .in("startlist_id", importIds);  // ← pas de limite explicite
```

Avec ~165 courses × ~160 coureurs/course = **~26 000 lignes**, la limite par défaut de 1000 lignes tronque silencieusement les résultats. La plupart des courses n'ont donc aucune donnée d'équipe confirmée → `total_teams = 0` → le badge ne s'affiche pas.

## Solution

Remplacer l'agrégation client-side par une **fonction SQL** côté base qui fait le `GROUP BY` et retourne directement `{ startlist_id, total_teams, confirmed_teams }`. Cela élimine le problème de limite et améliore les performances.

### 1. Migration SQL — Créer la fonction d'agrégation

```sql
CREATE OR REPLACE FUNCTION public.get_startlist_team_stats(p_startlist_ids uuid[])
RETURNS TABLE(startlist_id uuid, total_teams bigint, confirmed_teams bigint)
LANGUAGE sql STABLE
AS $$
  SELECT 
    se.startlist_id,
    COUNT(DISTINCT se.source_team) as total_teams,
    COUNT(DISTINCT CASE WHEN se.team_confirmed THEN se.source_team END) as confirmed_teams
  FROM startlist_entries se
  WHERE se.startlist_id = ANY(p_startlist_ids)
    AND se.source_team IS NOT NULL
  GROUP BY se.startlist_id
$$;
```

### 2. CalendarPage.tsx — Utiliser la fonction RPC

Remplacer les lignes 162-196 (la requête `startlist_entries` + agrégation JS) par un appel RPC :

```typescript
const { data: teamStats } = await supabase.rpc('get_startlist_team_stats', {
  p_startlist_ids: importIds
});
```

Puis mapper les résultats dans `confirmedTeamsMap` via `importToRace`.

### Fichiers modifiés
- Migration SQL — nouvelle fonction `get_startlist_team_stats`
- `src/pages/CalendarPage.tsx` — remplacer l'agrégation client par l'appel RPC

