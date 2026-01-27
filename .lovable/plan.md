

# Correction de l'encryption Web Push RFC 8291

## Problème identifié

L'encryption du payload utilise le **mauvais format info** pour dériver la CEK (Content Encryption Key) et le Nonce. Le code actuel utilise un format complexe avec les clés publiques, mais RFC 8291 spécifie un format simple.

### Pourquoi ça ne marche pas

1. **FCM accepte** la notification car l'enveloppe VAPID et le transport sont valides (status 201)
2. **Le navigateur ne peut pas décrypter** car il utilise RFC 8291 pour dériver CEK/Nonce, mais le serveur utilise un format incompatible
3. **Résultat** : L'événement `push` n'est jamais déclenché dans le Service Worker, ou le payload est corrompu

### Format correct (RFC 8291)

```text
IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_public || as_public)
CEK = HKDF(salt, IKM, "Content-Encoding: aes128gcm\0", 16)
NONCE = HKDF(salt, IKM, "Content-Encoding: nonce\0", 12)
```

La dérivation de l'IKM est correcte dans le code actuel. Seuls **cek_info** et **nonce_info** doivent être simplifiés.

## Solution

Modifier la fonction `encryptPayload` dans `send-push-notification/index.ts` pour utiliser le format RFC 8291 correct.

## Fichier modifié

**`supabase/functions/send-push-notification/index.ts`**

### Changement 1 : Supprimer la fonction `createInfo` (lignes 184-232)

Cette fonction n'est plus nécessaire car le format RFC 8291 est beaucoup plus simple.

### Changement 2 : Modifier `encryptPayload` (lignes 284-290)

Remplacer :

```typescript
// Derive content encryption key
const cekInfo = createInfo('aes128gcm', clientPublicKeyBytes, serverPublicKey);
const contentEncryptionKey = await hkdf(toArrayBuffer(salt), ikm, cekInfo, 16);

// Derive nonce
const nonceInfo = createInfo('nonce', clientPublicKeyBytes, serverPublicKey);
const nonce = await hkdf(toArrayBuffer(salt), ikm, nonceInfo, 12);
```

Par :

```typescript
// Derive content encryption key (RFC 8291: "Content-Encoding: aes128gcm\0")
const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
const contentEncryptionKey = await hkdf(toArrayBuffer(salt), ikm, toArrayBuffer(cekInfo), 16);

// Derive nonce (RFC 8291: "Content-Encoding: nonce\0")
const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
const nonce = await hkdf(toArrayBuffer(salt), ikm, toArrayBuffer(nonceInfo), 12);
```

## Impact

- La fonction `createInfo` peut être supprimée (simplification du code)
- Le payload sera correctement décrypté par le navigateur
- Les notifications apparaîtront enfin sur l'appareil

## Validation

Après déploiement :
1. Aller dans Compte > Notifications
2. Cliquer sur "Réinitialiser l'abonnement" (pour être sûr d'avoir une subscription propre)
3. Cliquer sur "Envoyer une notification test"
4. La notification devrait apparaître immédiatement sur l'appareil

