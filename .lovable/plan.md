## Objectif
Modifier le rythme d'affichage des annonces d'enchères (live et replay) pour accélérer le passage entre annonces, tout en ajoutant une pause de 5 secondes sur la dernière annonce pour qu'elle reste visible.

## Modifications

### 1. Frontend — Replay des annonces (`AuctionLiveAnnouncements.tsx`)
- **Changer l'interval** entre chaque apparition d'annonce en replay : `5000 ms` → `1000 ms`.
- **Ajouter un délai de 5 s** après la révélation de la dernière annonce (la plus chère) avant de basculer l'écran sur le message de fin (`isComplete`).
  - Technique : lorsque `count >= allAnnonces.length`, ne pas appeler `setIsReplaying(false)` immédiatement, mais attendre 5000 ms via un `setTimeout`.

### 2. Backend — Edge function `publier-annonce`
- **Uniformiser l'interval** entre publications d'annonces à `1000 ms` dans tous les cas (actuellement `10000 ms` en mode auto, `1000 ms` en manuel).
- Supprimer la distinction `auto_mode ? 10000 : 1000`.

## Fichiers concernés
- `src/components/auction/v2/AuctionLiveAnnouncements.tsx`
- `supabase/functions/publier-annonce/index.ts`

## Aucune modification de base de données requise.