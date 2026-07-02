Le timing actuel entre deux annonces est **1 seconde** (défini à deux endroits synchronisés).

## Changement

Passer ce délai de **1s → 2s**, en gardant les 5s finales pour la dernière annonce (inchangé).

## Fichiers modifiés

- `src/components/auction/v2/AuctionLiveAnnouncements.tsx` (ligne 140) : `1000` → `2000`
- `supabase/functions/publier-annonce/index.ts` (ligne 37) : `intervalMs = 1000` → `2000`