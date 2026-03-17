

## Ajouter un sélecteur de round dans l'écran des annonces live

### Contexte
L'écran `AuctionLiveAnnouncements` affiche les annonces d'un seul `auctionId` fixe. L'utilisateur souhaite pouvoir naviguer entre les différents rounds terminés pour revoir les annonces passées.

### Approche
Ajouter un sélecteur de rounds (boutons/tabs) dans le header de `AuctionLiveAnnouncements`, au-dessus ou à côté du titre "RÉSULTATS ROUND X". Ce sélecteur listera tous les rounds fermés (closed) de la même phase/league et permettra de basculer entre eux.

### Changements

**1. `AuctionLiveAnnouncements.tsx`** — Ajouter la logique de sélection de round :
- Ajouter un state `selectedAuctionId` initialisé avec le `auctionId` prop
- Ajouter une query pour récupérer tous les rounds fermés de la phase/league (`auctions` table, `statut = 'closed'`, ordonnés par `round_number`)
- Inclure aussi le round courant (passé en prop) dans la liste
- Afficher des boutons de sélection de round dans le header (style similaire aux tabs dans `AuctionRoundsHistory`)
- Quand l'utilisateur change de round, mettre à jour `selectedAuctionId` → la query `auction-get-live-status` se relance automatiquement avec le nouvel `auctionId`

**2. UI du sélecteur** — Dans la Card header existante :
- Ajouter une rangée de boutons scrollables sous le titre, un par round disponible
- Le round actif est mis en évidence (variant "default"), les autres en "outline"
- Format : "Round 1", "Round 2", "Round 3", etc.

Pas de changements nécessaires dans les composants parents ni dans l'edge function.

