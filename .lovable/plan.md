

## Corriger l'attribution des icônes prestige par ligue

### Problème
La fonction `get-manager-prestige-wins` cherche les propriétaires d'un coureur vainqueur dans `rosters` en filtrant uniquement par `coureur_id` + `phase_id`, **sans filtrer par `league_id`**. Résultat : si Matt B possède le même coureur qu'Obi dans une autre ligue, il hérite de l'icône Monument à tort.

### Cause racine
```typescript
// Ligne 111-115 — PAS de filtre league_id
const { data: owners } = await supabase
  .from('rosters')
  .select('manager_id')
  .eq('coureur_id', result.coureur_id)
  .eq('phase_id', course.phase_id);
```

### Solution

**1. Ajouter `league_id` en paramètre d'entrée** de la fonction edge `get-manager-prestige-wins`

**2. Filtrer les rosters par `league_id`** dans la requête (ligne 115) :
```typescript
.eq('league_id', league_id)
```

**3. Mettre à jour le hook `useManagerPrestigeWins`** pour passer le `league_id` depuis le contexte de ligue.

**4. Mettre à jour les appels** dans `ManagerPrestigeIcons` et ses parents pour transmettre le `league_id`.

### Fichiers impactés
- `supabase/functions/get-manager-prestige-wins/index.ts` — ajout filtre `league_id`
- `src/hooks/useManagerPrestigeWins.tsx` — ajout param `league_id`
- `src/components/rankings/ManagerPrestigeIcons.tsx` — passage du `league_id`
- Parents qui utilisent `ManagerPrestigeIcons` (classement) — transmission du `league_id`

