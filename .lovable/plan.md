

## Ajouter un onglet "Annonces" dans AuctionTabs

### Contexte
L'écran principal des enchères (screenshot) affiche des onglets : "+ Enchérir", "Round 3", "Round 2", "Round 1", "Équipes adverses". L'utilisateur veut un bouton/onglet à côté de "Équipes adverses" pour revoir les annonces des rounds fermés.

### Changements

**`src/components/auction/v2/AuctionTabs.tsx`** :
- Ajouter un nouvel onglet "Annonces" (avec icône Megaphone) après "Équipes adverses"
- Ajouter un `TabsContent` pour cet onglet qui affiche le composant `AuctionLiveAnnouncements`
- Utiliser le premier round fermé comme `auctionId` par défaut (le sélecteur de rounds est déjà intégré dans `AuctionLiveAnnouncements`)
- L'onglet n'apparaît que s'il y a au moins un round fermé

**Aucun changement** dans les composants parents — tout reste dans `AuctionTabs`.

