
# Analyse de la latence mobile (1-2 secondes entre les ecrans)

## Problemes identifies

Apres analyse du code, j'ai identifie plusieurs facteurs qui contribuent a la latence observee lors de la navigation entre les ecrans sur mobile.

---

## 1. Cascade de chargements asynchrones (probleme principal)

Chaque page mobile depend d'une chaine de chargements sequentiels qui ne peuvent pas commencer avant que le precedent soit termine :

```text
1. useIsMobile() → retourne undefined puis true (re-render)
   |
   2. LeagueContext → charge les ligues utilisateur (~200-500ms)
      |
      3. SeasonContext → charge les saisons et phases (~200-400ms)
         |
         4. Contenu de la page → charge les donnees specifiques (~500-1000ms)
```

**Impact** : Chaque etape attend la precedente, ce qui cree une latence cumulee de 1-2 secondes.

---

## 2. Hook `useIsMobile()` avec etat initial `undefined`

```typescript
// src/hooks/use-mobile.tsx
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
  // ...
  return !!isMobile; // Retourne false au premier render, puis true
}
```

**Probleme** : L'etat initial est `undefined`, converti en `false`. Cela cause :
- Un premier rendu en mode "desktop"
- Un second rendu en mode "mobile" une fois l'effet execute
- Double initialisation des composants

---

## 3. Chargements redondants dans les Contexts

**LeagueContext** (lignes 29-52) :
- Charge les ligues utilisateur a chaque montage
- Appelle `queryClient.invalidateQueries()` a chaque changement de ligue (ligne 87)

**SeasonContext** (lignes 61-121) :
- Attend que `LeagueContext` soit pret (`if (leagueLoading) return`)
- Fait plusieurs appels Supabase en cascade

---

## 4. Requetes non-parallelisees dans les pages

**Exemple dans `MyTeam.mobile.tsx`** (lignes 129-149) :
```typescript
useEffect(() => { loadCurrentUser(); }, []);
useEffect(() => { loadManagers(); }, [leagueId]);
useEffect(() => { loadTeamWithKpis(); }, [selectedPhaseId, ...]);
```

Ces effets s'executent en cascade plutot qu'en parallele.

---

## Solutions proposees

### Solution 1 : Optimiser `useIsMobile()` (impact immediat)

Initialiser l'etat avec une valeur SSR-safe basee sur la detection cote client :

```typescript
const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // Detection initiale synchrone si disponible
    if (typeof window !== 'undefined') {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
    return false; // Fallback SSR
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
```

**Gain estime** : ~50-100ms (elimination du double render initial)

---

### Solution 2 : Pre-fetching des donnees dans LeagueContext

Paralleliser le chargement des saisons avec les ligues :

```typescript
// Dans LeagueProvider
const { data: userLeagues } = useQuery({
  queryKey: ['user-leagues-for-context'],
  queryFn: async () => {
    // Charger ligues + saisons en parallele
    const [membershipsResult, seasonsResult] = await Promise.all([
      supabase.from('league_members').select(...),
      supabase.from('saisons').select('id, annee')
    ]);
    return { leagues: ..., seasons: seasonsResult.data };
  }
});
```

**Gain estime** : ~200-400ms

---

### Solution 3 : Supprimer l'invalidation globale des queries

Remplacer `queryClient.invalidateQueries()` par des invalidations ciblees :

```typescript
// LeagueContext ligne 87 - A remplacer
queryClient.invalidateQueries({ queryKey: ['league-specific-data'] });
```

**Gain estime** : ~100-300ms (evite les re-fetches inutiles)

---

### Solution 4 : Prefetch lors de la navigation

Ajouter du prefetching dans `MobileBottomBar` :

```typescript
const prefetchPageData = (path: string) => {
  if (path.includes('classement')) {
    queryClient.prefetchQuery(['manager-standings-mobile', ...]);
  }
  // etc.
};

// Sur hover/focus du bouton
onTouchStart={() => prefetchPageData(route.path)}
```

---

### Solution 5 : Paralleliser les requetes dans les pages mobiles

**Exemple pour `MyTeam.mobile.tsx`** :

```typescript
// Remplacer les 3 useEffect par un seul avec Promise.all
useEffect(() => {
  if (!leagueId) return;
  
  const loadAll = async () => {
    const [user, managers, team] = await Promise.all([
      loadCurrentUser(),
      loadManagers(),
      selectedPhaseId ? loadTeamWithKpis() : null
    ]);
    // ...
  };
  
  loadAll();
}, [leagueId, selectedPhaseId]);
```

---

## Plan d'implementation

| Priorite | Solution | Fichiers | Gain estime |
|----------|----------|----------|-------------|
| 1 | Optimiser `useIsMobile()` | `src/hooks/use-mobile.tsx` | 50-100ms |
| 2 | Pre-fetching saisons | `src/contexts/LeagueContext.tsx` | 200-400ms |
| 3 | Invalidation ciblee | `src/contexts/LeagueContext.tsx` | 100-300ms |
| 4 | Paralleliser requetes pages | `MyTeam.mobile.tsx`, `Rankings.mobile.tsx`, etc. | 200-400ms |
| 5 | Prefetch navigation | `src/components/mobile/MobileBottomBar.tsx` | 100-200ms |

**Gain total estime** : 650ms - 1.4s (reduction significative de la latence)

---

## Resume des fichiers a modifier

- `src/hooks/use-mobile.tsx` - Detection synchrone initiale
- `src/contexts/LeagueContext.tsx` - Pre-fetch + invalidation ciblee
- `src/contexts/SeasonContext.tsx` - Parallelisation des requetes
- `src/components/mobile/MobileBottomBar.tsx` - Prefetch au hover
- `src/components/team/MyTeam.mobile.tsx` - Parallelisation
- `src/pages/Rankings.mobile.tsx` - Parallelisation
- `src/pages/Startlist.mobile.tsx` - Parallelisation
- `src/pages/ResultsPage.mobile.tsx` - Parallelisation
