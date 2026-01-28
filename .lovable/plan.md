

# Plan d'optimisation de la latence mobile - Phase 3

## Diagnostic

Apres analyse des requetes reseau, j'ai identifie plusieurs goulots d'etranglement restants.

### Problemes detectes

1. **Appels d'authentification redondants**
   - La requete `/auth/v1/user` est appelee 2-3 fois simultanement
   - Chaque composant (`LeagueContext`, `Dashboard`, `MyTeam.mobile`) fait son propre appel

2. **Requetes `managers` dupliquees**
   - La meme requete `managers?select=id&user_id=...` est executee 3 fois par chargement
   - Aucun partage de cache entre `Dashboard.tsx`, `MyTeam.mobile.tsx`, et les hooks

3. **Hook `useUserRole` non optimise**
   - Appel RPC `is_superadmin` a chaque montage sans cache
   - Utilise par 12+ composants (peut declencher plusieurs appels)

4. **Chargement sequentiel dans Dashboard**
   - `loading || roleLoading` bloque tout l'affichage
   - Les donnees d'authentification et de role sont chargees en cascade

---

## Solution proposee

### 1. Creer un hook `useCurrentManager` cache (PRIORITE 1)

Centraliser la recuperation du manager courant avec React Query.

**Fichier : `src/hooks/useCurrentManager.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentManager() {
  return useQuery({
    queryKey: ["current-manager"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const { data: manager } = await supabase
        .from("managers")
        .select("id, nom, user_id, avatar_url")
        .eq("user_id", session.user.id)
        .maybeSingle();
      
      return manager;
    },
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}
```

**Gain estime :** 200-300ms (elimination des 3 appels redondants)

---

### 2. Migrer `useUserRole` vers React Query (PRIORITE 2)

**Fichier : `src/hooks/useUserRole.tsx`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { isSuperAdmin: false, isLeagueAdminOnly: false };

      // Check superadmin
      const { data: isSuperAdminData } = await supabase.rpc('is_superadmin');
      const isSuperAdmin = isSuperAdminData || false;
      
      if (isSuperAdmin) {
        return { isSuperAdmin: true, isLeagueAdminOnly: false };
      }
      
      // Check league admin
      const { data: memberships } = await supabase
        .from('league_members')
        .select('role_in_league')
        .eq('user_id', session.user.id)
        .in('role_in_league', ['owner', 'admin']);
      
      return { 
        isSuperAdmin: false, 
        isLeagueAdminOnly: (memberships?.length || 0) > 0 
      };
    },
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
  });

  return {
    isSuperAdmin: data?.isSuperAdmin ?? false,
    isLeagueAdminOnly: data?.isLeagueAdminOnly ?? false,
    isAdmin: (data?.isSuperAdmin || data?.isLeagueAdminOnly) ?? false,
    loading: isLoading,
  };
};
```

**Gain estime :** 100-200ms (cache partage entre 12+ composants)

---

### 3. Optimiser `Dashboard.tsx` pour charger en parallele (PRIORITE 3)

Remplacer le chargement sequentiel par un chargement parallele utilisant les nouveaux hooks caches.

**Modifications dans `Dashboard.tsx` :**

```typescript
// Remplacer:
const [loading, setLoading] = useState(true);
const [manager, setManager] = useState<any>(null);
// ...checkUser() useEffect

// Par:
import { useCurrentManager } from "@/hooks/useCurrentManager";

const { data: manager, isLoading: managerLoading } = useCurrentManager();
const { isSuperAdmin, isLeagueAdminOnly, loading: roleLoading } = useUserRole();

// Le loading devient simplement:
if (managerLoading || roleLoading) { ... }
```

**Gain estime :** 100-200ms (elimination d'un useEffect sequentiel)

---

### 4. Utiliser le hook dans `MyTeam.mobile.tsx` (PRIORITE 4)

**Modifications dans `MyTeam.mobile.tsx` :**

```typescript
// Remplacer:
const [currentUserId, setCurrentUserId] = useState<string | null>(null);
// ...loadCurrentUser()

// Par:
import { useCurrentManager } from "@/hooks/useCurrentManager";
const { data: currentManager } = useCurrentManager();
const currentUserId = currentManager?.id ?? null;
```

**Gain estime :** 50-100ms

---

## Resume des modifications

| Fichier | Modification |
|---------|--------------|
| `src/hooks/useCurrentManager.ts` | Nouveau hook avec cache React Query |
| `src/hooks/useUserRole.tsx` | Migration vers React Query |
| `src/pages/Dashboard.tsx` | Utiliser useCurrentManager |
| `src/components/team/MyTeam.mobile.tsx` | Utiliser useCurrentManager |
| `src/pages/Rankings.mobile.tsx` | Supprimer appels auth redondants si presents |
| `src/pages/Startlist.mobile.tsx` | Supprimer appels auth redondants si presents |

---

## Gains estimes

| Optimisation | Gain |
|--------------|------|
| Hook `useCurrentManager` cache | 200-300ms |
| Migration `useUserRole` React Query | 100-200ms |
| Parallelisation Dashboard | 100-200ms |
| Nettoyage composants | 50-100ms |

**Gain total Phase 3 :** 450-800ms

**Gain cumule (Phase 1 + 2 + 3) :** 1.1s - 2.2s

---

## Optimisations futures (Phase 4)

Pour aller encore plus loin, on pourrait :

1. **Optimiser les edge functions** : Paralleliser les queries dans `manager-my-team` et `get-team-riders-races`
2. **Ajouter le SSR partiel** : Pre-rendre les skeletons cote serveur
3. **Implementer le prefetch au login** : Charger les donnees critiques des le login

