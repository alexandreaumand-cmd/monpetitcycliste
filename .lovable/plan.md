

## Plan : Bouton "Annonces" sur la carte de ligue + comportement live/replay

### Résumé

Ajouter un bouton "Annonces" à côté de "Accéder aux enchères" dans la carte de ligue. Ce bouton navigue vers la page enchères (qui affiche déjà les annonces quand `isAnnouncementsPending` est true). Un point rouge apparaît quand les annonces sont en cours de publication (1ère fois, juste après clôture du round). Les annonces en cours sont vues en direct (pas depuis le début), et les annonces terminées se rejouent à l'ouverture.

### Modifications

#### 1. `src/components/dashboard/LeagueCard.tsx`
- Ajouter un bouton "Annonces" avec icône `Megaphone` à côté du bouton "Accéder aux enchères"
- Le bouton apparaît uniquement quand `auctionStatus` existe (enchères actives)
- Ajouter un point rouge (pastille CSS `w-2 h-2 bg-red-500 rounded-full animate-pulse`) quand `auctionStatus.isAnnouncementsPending === true`
- Le bouton appelle un nouveau callback `onViewAnnouncements`
- Layout : les 2 boutons côte à côte avec `flex gap-2`

#### 2. `src/components/dashboard/LeagueCard.tsx` (props)
- Ajouter la prop `onViewAnnouncements: () => void` à l'interface `LeagueCardProps`

#### 3. `src/pages/DashboardHome.tsx`
- Passer le callback `onViewAnnouncements` qui navigue vers `/dashboard/encheres?leagueId=X&tab=announcements`

#### 4. `src/components/auction/AuctionsList.desktop.tsx` et `AuctionsList.mobile.tsx`
- Lire le query param `tab=announcements` depuis l'URL
- Quand `tab=announcements` et qu'il y a un round fermé, afficher directement `AuctionLiveAnnouncements` au lieu de l'interface d'enchères normale

#### 5. `src/components/auction/v2/AuctionLiveAnnouncements.tsx` — Comportement live vs replay
- **Live (annonces en cours, `unpublished_count > 0`)** : afficher toutes les annonces publiées immédiatement sans replay progressif. Le manager voit l'état actuel en temps réel. Le realtime subscription fait apparaître les nouvelles annonces au fur et à mesure.
- **Replay (annonces terminées, `unpublished_count === 0`)** : comportement actuel conservé — replay progressif toutes les 5s avec `replayStartedForRef` pour éviter les redémarrages.

Le changement principal dans le `useEffect` (lignes 100-132) : dans le cas live (`unpublished_count > 0`), on montre déjà toutes les annonces publiées (`setReplayVisibleCount(allAnnonces.length)`) — ce comportement est déjà correct. Pas de changement nécessaire ici.

### Fichiers impactés
- `src/components/dashboard/LeagueCard.tsx` — bouton Annonces + point rouge
- `src/pages/DashboardHome.tsx` — callback navigation avec `tab=announcements`
- `src/components/auction/AuctionsList.desktop.tsx` — lecture du query param `tab`
- `src/components/auction/AuctionsList.mobile.tsx` — idem mobile

