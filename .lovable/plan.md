

# Diagnostic : "Edge Function returned a non-2xx status code" sur clore-round

## Cause probable

Le dernier déploiement vers l'environnement LIVE a échoué (erreur "restore point already being created"). Les edge functions en LIVE sont donc dans un état obsolète ou incohérent.

Les logs de `clore-round` en production montrent uniquement `booted (time: 22ms)` — aucune trace d'exécution (pas de "Closing round for auction:..." ni d'erreur). Cela signifie que la fonction plante avant même d'exécuter son code, probablement à cause d'un import cassé ou d'une version stale.

## Solution

### Etape 1 : Republier le projet
La correction est simple : **republier le projet** pour que les edge functions soient redéployées en LIVE. Le problème de restore point devrait être résolu maintenant (il date de plusieurs heures).

### Etape 2 : Vérifier le double-close
Il y a un bug potentiel dans `AuctionManager.tsx` et `useAuctionOperations.ts` : la mutation `closeAuction` fait d'abord un `UPDATE auctions SET statut='closed'` côté client, **puis** appelle `clore-round` qui refait le même UPDATE (ligne 122-125 de l'edge function). Si l'edge function échoue, l'enchère est marquée "closed" en base mais jamais traitée (bids non résolus, annonces non créées).

**Correction** : Retirer le `UPDATE` côté client et laisser la fonction `clore-round` gérer tout le cycle. Cela évitera les états incohérents si la fonction échoue.

Fichiers impactés :
- `src/components/admin/AuctionManager.tsx` — retirer le pre-update lignes 44-48
- `src/hooks/useAuctionOperations.ts` — retirer le pre-update lignes 112-116

### Etape 3 : Vérifier la ligue "Test DL"
Après republication, vérifier si l'enchère de "Test DL" est toujours en état "closed" (à cause du pre-update client) sans avoir été traitée. Si c'est le cas, utiliser le bouton "Retraiter" pour relancer `clore-round` sur cette enchère.

