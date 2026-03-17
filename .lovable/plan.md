

## Ajouter un bouton "Revoir les annonces" dans AuctionCompletedView

### Contexte
L'écran `AuctionCompletedView` s'affiche quand le manager a complété son équipe mais que la phase n'est pas encore terminée (d'autres rounds sont en cours). L'utilisateur souhaite pouvoir revoir les annonces de n'importe quel round fermé depuis cet écran.

### Approche
Ajouter une section dans `AuctionCompletedView` avec un bouton par round fermé pour ouvrir les annonces. Au clic, afficher le composant `AuctionLiveAnnouncements` (qui intègre déjà un sélecteur de rounds) en remplacement de la vue actuelle, avec un bouton retour.

### Changements

**`src/components/auction/v2/AuctionCompletedView.tsx`** :
- Ajouter un state `showAnnouncements` et `selectedAuctionId`
- Ajouter une query pour récupérer les rounds fermés de la phase/league (table `auctions`, `statut = 'closed'`, ordonnés par `round_number`)
- Ajouter une Card avec une Accordion contenant un bouton par round fermé (style : icône Megaphone + "Annonces Round X")
- Au clic sur un round, passer `showAnnouncements = true` avec l'`auctionId` correspondant
- Quand `showAnnouncements` est true, rendre `AuctionLiveAnnouncements` avec un `onBack` pour revenir à la vue complétée
- Le composant `AuctionLiveAnnouncements` possède déjà le sélecteur de rounds intégré, donc l'utilisateur pourra naviguer entre les rounds une fois dedans

**Pas de changements** nécessaires dans les composants parents (`AuctionPageDesktop`, `AuctionPageMobile`) ni dans l'edge function.

