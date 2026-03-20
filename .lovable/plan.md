

## Plan : Rediriger vers les annonces quand le round se clôture

### Problème

Quand le manager est sur la page d'attente (validation confirmation) et que le round se clôture :
1. `auction-get-context` ne trouve plus d'enchère `open` → retourne `{ error: 'No active auction', ... }` 
2. Ce résultat est **truthy**, donc le check `!context` (ligne 466) est faux
3. Le state `showValidationScreen` reste `true` (jamais remis à false)
4. Le composant continue d'afficher `AuctionValidationConfirmation` — la page d'attente figée

### Solution

Modifier `AuctionPageMobile.tsx` pour détecter quand le context indique "No active auction" alors que le manager était en attente, et basculer automatiquement vers l'écran d'annonces.

**Fichier impacté** : `src/components/auction/v2/AuctionPageMobile.tsx`

Ajouter un `useEffect` qui détecte la transition :
- Si `context` est chargé mais `context.auction_id` est absent (pas d'enchère ouverte)
- ET que `showValidationScreen` est true (le manager attendait)
- ET qu'il y a un `lastClosedAuction` (round venant de se fermer)
- → Désactiver `showValidationScreen` et laisser le check `shouldShowLiveScreen` ou le fallback `lastClosedAuction` prendre le relais

Concrètement :
1. Traiter le contexte "No active auction" comme `null` (contexte invalide) en ajoutant un check sur `context?.error`
2. Ajouter un `useEffect` qui réagit au changement : quand `context` devient null/erreur et `showValidationScreen` est true → reset le state et s'assurer que les annonces s'affichent

### Détails techniques

```tsx
// Normaliser le context: si "No active auction", traiter comme null
const effectiveContext = context?.auction_id ? context : null;

// useEffect: quand le round se ferme pendant l'attente
useEffect(() => {
  if (!effectiveContext && showValidationScreen) {
    setShowValidationScreen(false);
    setHideLiveAnnouncements(false); // S'assurer que les annonces s'affichent
  }
}, [effectiveContext, showValidationScreen]);
```

Puis remplacer toutes les utilisations de `context` par `effectiveContext` dans les conditions d'affichage, ce qui permettra au check existant `!context && lastClosedAuction && !hideLiveAnnouncements` de fonctionner et d'afficher `AuctionLiveAnnouncements`.

