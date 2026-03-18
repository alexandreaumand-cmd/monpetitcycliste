

## Plan : Bouton "IA Premium" sur la page enchères

### Objectif
Ajouter un bouton avec icône Sparkles (baguette magique) à côté du bouton "Importer favoris" dans les filtres d'enchères. Au clic, afficher un dialog humoristique indiquant que la fonctionnalité est réservée aux membres premium. Le bouton n'est visible que pour la ligue **MPC 2026** (`b5b46b5e-7c78-4ad9-a669-b08e8f099800`).

### Fichiers modifiés

**1. `src/components/auction/v2/AuctionSearchFilters.tsx`**
- Ajouter une prop `leagueId?: string` au composant
- Ajouter un state `showPremiumDialog` (boolean)
- Ajouter un bouton avec icône `Sparkles` (lucide-react), visible uniquement si `leagueId === 'b5b46b5e-7c78-4ad9-a669-b08e8f099800'`
- Style : violet/gradient pour se démarquer des autres boutons
- Ajouter un `Dialog` avec le message "Pour accéder à cette fonctionnalité, vous devez être membre premium. Faire un virement au BOSS" et un bouton "Compris"

**2. `src/components/auction/v2/AuctionTabs.tsx`** (et `AuctionPageDesktop.tsx` si applicable)
- Passer `leagueId` comme prop à `AuctionSearchFilters`

**3. Traductions `src/i18n/locales/fr/auction.json` et `en/auction.json`**
- Ajouter clés : `ai.recommend` ("Recommandation IA"), `ai.premiumTitle` ("Fonctionnalité Premium"), `ai.premiumMessage` ("Pour accéder à cette fonctionnalité..."), `ai.understood` ("Compris")

### Pas de changement backend
Aucune edge function, migration ou modification de table nécessaire.

