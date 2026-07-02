## Objectif
Mettre en évidence les annonces où le manager courant a **perdu** l'enchère, avec un style rouge, en complément du surlignage existant pour les gains.

## Changements

### 1. Backend — enrichir `losers_json` avec `manager_id`
`supabase/functions/clore-round/index.ts` : ajouter `manager_id: b.manager_id` (et `winner.manager_id` dans le cas de dégradation en égalité) dans chaque entrée `losers_json`. Ainsi les futures annonces embarquent l'identité des perdants de façon fiable.

### 2. Backend — exposer `is_my_loss`
`supabase/functions/auction-get-live-status/index.ts` : dans le mapping des annonces, calculer :
```
is_my_loss = type === 'gain'
  && !is_my_win
  && losers.some(l => l.manager_id === manager.id || l.manager === manager.nom)
```
Le fallback par `manager.nom` couvre les annonces déjà existantes sans `manager_id`.

### 3. Frontend — style rouge
`src/components/auction/v2/AuctionLiveAnnouncements.tsx` :
- Étendre le type d'annonce avec `is_my_loss?: boolean`.
- Dans le bloc `className` (ligne 408), ajouter une variante rouge :
  - `is_my_win` → vert primary (inchangé)
  - `is_my_loss` → `bg-destructive/10 border-destructive`
  - défaut → `bg-card`
- Dans la liste des losers (ligne 454-456), si `is_my_loss`, surligner l'entrée correspondant au manager courant en rouge (`text-destructive font-semibold`) plutôt que la ligne neutre.

## Fichiers modifiés
- `supabase/functions/clore-round/index.ts`
- `supabase/functions/auction-get-live-status/index.ts`
- `src/components/auction/v2/AuctionLiveAnnouncements.tsx`