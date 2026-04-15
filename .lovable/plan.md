

# Fix : Bouton "Annonces" inopérant sur l'écran de validation

## Diagnostic

**Deux problèmes identifiés :**

1. **Guard trop strict côté client** — Le rendu des annonces (ligne 547 mobile / 519 desktop) exige `validatedAuctionId` non-null :
   ```
   if (showValidationScreen && showPastAnnouncements && validatedAuctionId)
   ```
   Si `context?.auction_id` n'est pas encore chargé au moment de l'entrée dans l'écran de validation, `validatedAuctionId` reste `null`. Cliquer sur "Annonces" met `showPastAnnouncements = true`, mais la condition échoue → le même écran de validation se ré-affiche. Le bouton semble ne rien faire.

2. **Edge Function crash sur auth header null** — `req.headers.get('Authorization')!` (ligne 16) crashe si le header est absent, causant une erreur 500 au lieu d'un 401 propre.

## Corrections

### 1. `AuctionPageMobile.tsx` — Supprimer le guard `validatedAuctionId` et utiliser un fallback
Ligne 547 : remplacer la condition pour utiliser l'`auctionId` du contexte en fallback :
```typescript
const effectiveAuctionIdForAnnouncements = validatedAuctionId || context?.auction_id;

if (showValidationScreen && showPastAnnouncements && effectiveAuctionIdForAnnouncements) {
  return (
    <AuctionLiveAnnouncements
      auctionId={effectiveAuctionIdForAnnouncements}
      ...
    />
  );
}
```

### 2. `AuctionPageDesktop.tsx` — Même correction
Ligne 519 : appliquer le même pattern de fallback.

### 3. `auction-get-live-status/index.ts` — Guard auth header null
Ligne 16 : vérifier que l'auth header existe avant de l'utiliser :
```typescript
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

## Fichiers modifiés
1. `src/components/auction/v2/AuctionPageMobile.tsx` — fallback auctionId
2. `src/components/auction/v2/AuctionPageDesktop.tsx` — idem
3. `supabase/functions/auction-get-live-status/index.ts` — guard auth header

