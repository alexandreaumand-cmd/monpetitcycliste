

## Plan : Bouton IA icône seule + popup vendeur

### Modifications

**1. `src/components/auction/v2/AuctionSearchFilters.tsx`**
- Bouton IA : remplacer `size="default"` par `size="icon"`, supprimer le texte `{t("ai.recommend")}`, ne garder que l'icône `Sparkles`

**2. `src/i18n/locales/fr/auction.json`**
- Modifier `ai.premiumMessage` : "Notre IA analyse en temps réel les cotes, l'historique des enchères et votre budget pour vous proposer les meilleurs coureurs au meilleur prix. Débloquez cette fonctionnalité premium en faisant un virement au BOSS 💸"

**3. `src/i18n/locales/en/auction.json`**
- Modifier `ai.premiumMessage` : "Our AI analyzes odds, auction history and your budget in real-time to recommend the best riders at the best price. Unlock this premium feature by sending a wire transfer to the BOSS 💸"

