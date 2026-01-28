

# Plan d'optimisation de la latence mobile - Phase 2

## Etat des lieux apres Phase 1

**Deja optimise :**
- `useIsMobile()` - Detection synchrone
- `LeagueContext` - Invalidation ciblee
- `MyTeam.mobile.tsx` - Parallelisation initiale
- `ResultsPage.mobile.tsx` - Guards anti-premature

**Gain realise :** ~250-600ms

---

## Optimisations restantes

### 1. SeasonContext.tsx - Parallelisation des requetes

**Probleme actuel (lignes 61-121) :**
```text
1. Attendre leagueLoading → 
2. Charger saisons → 
3. Charger league_scopes → 
4. Charger phases (2e useEffect)
```

**Solution :** Charger `saisons` et `league_scopes` en parallele avec `Promise.all`, puis enchainer phases immediatement.

**Modification :**
```typescript
// Charger saisons ET scope en parallele
const [seasonsResult, scopeResult] = await Promise.all([
  supabase.from("saisons").select("id, annee").order("annee", { ascending: false }),
  leagueId 
    ? supabase.from("league_scopes").select("season_id").eq("league_id", leagueId).maybeSingle()
    : Promise.resolve({ data: null })
]);

// Determiner la saison cible
const targetSeasonId = scopeResult.data?.season_id || seasonsResult.data?.[0]?.id;
const targetSeason = seasonsResult.data?.find(s => s.id === targetSeasonId);

// Charger les phases immediatement (meme useEffect)
if (targetSeason) {
  const { data: phasesData } = await supabase
    .from("phases")
    .select("*")
    .eq("saison_id", targetSeason.id)
    .order("index_dans_saison", { ascending: true });
  
  // Set tout en une fois
  setSeasons(seasonsResult.data);
  setSelectedSeasonState(targetSeason);
  setPhases(phasesData);
  setActivePhase(computeActivePhase(phasesData));
}
```

**Gain estime :** 200-400ms (elimination du 2e useEffect sequentiel)

---

### 2. MobileBottomBar.tsx - Prefetch au touch

**Probleme actuel :** Aucun prefetch, les donnees sont chargees seulement apres navigation.

**Solution :** Utiliser `onTouchStart` pour prefetcher les donnees de la page cible avant le clic.

**Modification :**
```typescript
import { useQueryClient } from "@tanstack/react-query";
import { useSeasonContext } from "@/contexts/SeasonContext";

const queryClient = useQueryClient();
const { selectedSeason } = useSeasonContext();

const prefetchPageData = (path: string) => {
  if (!currentLeagueId) return;
  
  if (path.includes('classement')) {
    queryClient.prefetchQuery({
      queryKey: ["manager-standings-mobile", null, selectedSeason?.id, currentLeagueId],
      staleTime: 30000,
    });
  } else if (path.includes('resultats')) {
    queryClient.prefetchQuery({
      queryKey: ["mobile-races", currentLeagueId],
      staleTime: 30000,
    });
  } else if (path.includes('startlist')) {
    queryClient.prefetchQuery({
      queryKey: ["startlists-info"],
      staleTime: 30000,
    });
  }
};

// Dans le JSX:
<button
  onTouchStart={() => prefetchPageData(route.path)}
  onClick={() => navigate(buildNavUrl(route.path))}
  ...
>
```

**Gain estime :** 100-200ms (donnees deja en cache avant navigation)

---

### 3. Rankings.mobile.tsx - Parallelisation

**Probleme actuel :** Les requetes `standings`, `previousGlobalStandings`, et `topRiders` sont declenchees separement.

**Observation :** Les queries utilisent deja React Query et sont donc deja parallelisees automatiquement. Aucune modification necessaire ici.

**Optimisation possible :** Ajouter `staleTime` pour eviter les re-fetches inutiles.

```typescript
const { data: standings } = useQuery({
  queryKey: ["manager-standings-mobile", selectedPhase, selectedSeason?.id, leagueId],
  staleTime: 60000, // Cache 1 minute
  // ...
});
```

---

### 4. Startlist.mobile.tsx - Parallelisation

**Probleme actuel (lignes 69-167) :** 3 queries separees pour `currentUserManagerId`, `races`, et `startlistsInfo`.

**Observation :** React Query parallelise deja automatiquement. Optimisation possible via `staleTime`.

**Modifications :**
- Ajouter `staleTime` aux queries
- Ajouter guard sur `isLoadingContext` pour eviter les fetches prematures

```typescript
const { data: races } = useQuery({
  queryKey: ["startlist-races", leagueId, selectedSeason?.id, tabMode],
  staleTime: 60000, // Cache 1 minute
  enabled: !!leagueId && !!selectedSeason?.id && !isLoadingContext,
  // ...
});
```

---

## Resume des modifications

| Fichier | Modification | Gain |
|---------|--------------|------|
| `SeasonContext.tsx` | Promise.all pour saisons + scope + phases | 200-400ms |
| `MobileBottomBar.tsx` | Prefetch onTouchStart | 100-200ms |
| `Rankings.mobile.tsx` | Ajouter staleTime | 50-100ms |
| `Startlist.mobile.tsx` | Guard + staleTime | 50-100ms |

**Gain total Phase 2 :** 400-800ms

**Gain cumule (Phase 1 + 2) :** 650ms - 1.4s

---

## Details techniques

### SeasonContext - Nouvelle structure

Le useEffect unique chargera tout en sequence optimisee :
1. `Promise.all([saisons, scope])` - Parallele
2. Determiner saison cible
3. Charger phases pour cette saison
4. Set tous les states en une fois

Cela elimine le 2e useEffect qui attendait `selectedSeason` pour charger les phases.

### MobileBottomBar - Queries a prefetcher

Pour chaque route :
- `/classement` → `manager-standings-mobile`
- `/resultats` → `mobile-races`
- `/startlist` → `startlists-info`
- `/mon-equipe` → Deja gere par MyTeam
- `/courses` → `startlist-races`

