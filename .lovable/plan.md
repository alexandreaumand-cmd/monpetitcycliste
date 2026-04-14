

# Fix : Redirection vers les annonces après validation du dernier manager + bouton "Annonces" inactif

## Diagnostic

**Problème 1 — Pas de redirection automatique :**
Quand le dernier manager valide, l'auction est auto-clôturée (statut passe de `open` à `closed`). Le `context` (via `auction-get-context`) peut retourner `null` si l'edge function ne renvoie rien pour une auction fermée. Sur desktop, `shouldShowLiveScreen` requiert `context?.auction?.statut === 'closed'` — si `context` est `null`, la condition est fausse. Le `showValidationScreen` reste `true`, affichant l'écran de confirmation au lieu des annonces.

Le mobile a un `useEffect` de redirection (lignes 147-153) mais il se contente de fermer le validation screen sans rediriger vers les annonces. Le desktop n'a même pas ce `useEffect`.

**Problème 2 — Bouton "Annonces" inactif :**
Le bouton appelle `setShowPastAnnouncements(true)`. Le rendu vérifie `showValidationScreen && showPastAnnouncements && validatedAuctionId` (ligne 511). Le `validatedAuctionId` est bien défini, mais le composant `AuctionLiveAnnouncements` reçoit un `auctionId` d'une auction désormais fermée. Si l'edge function qui alimente les annonces ne retourne rien pour cette auction (ou si elle échoue silencieusement), l'écran paraît vide/inactif.

## Solution

### 1. `AuctionValidationConfirmation.tsx` — Auto-redirection quand tous ont validé
Ajouter un `useEffect` qui détecte `allValidated` et appelle automatiquement `onViewAnnouncements()` après un court délai (2-3 secondes), permettant au manager de voir le message "Tous les managers ont validé" avant d'être redirigé.

### 2. `AuctionPageDesktop.tsx` — Ajout du useEffect de redirection (comme mobile)
Ajouter le même `useEffect` que dans le mobile : quand `context` devient `null` alors que `showValidationScreen` est `true`, réinitialiser `showValidationScreen` et `hideLiveAnnouncements` pour permettre au cycle normal de reprendre.

### 3. `AuctionPageDesktop.tsx` et `AuctionPageMobile.tsx` — Fallback annonces depuis validation screen
Quand `showPastAnnouncements` est true et `validatedAuctionId` est set, ne plus exiger que `context` soit présent. Le code actuel est correct côté condition mais il faut vérifier que `AuctionLiveAnnouncements` gère correctement un auction_id d'une auction `closed`.

### 4. Vérification de `AuctionLiveAnnouncements`
S'assurer que le composant fonctionne avec une auction fermée (les annonces sont déjà publiées, pas besoin d'attendre le realtime).

## Fichiers modifiés
1. `src/components/auction/v2/AuctionValidationConfirmation.tsx` — auto-redirect vers annonces
2. `src/components/auction/v2/AuctionPageDesktop.tsx` — useEffect de fallback context=null
3. `src/components/auction/v2/AuctionPageMobile.tsx` — améliorer le useEffect existant

