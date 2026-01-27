
# Correction de l'Edge Function Push Notifications

## Problème Identifié

L'erreur `InvalidEncoding` à la ligne 96 indique que l'importation de la clé privée VAPID échoue. L'implémentation actuelle a deux problèmes :

1. **Mauvais format PKCS8** : Le header PKCS8 hardcodé n'est pas compatible avec toutes les clés VAPID
2. **Pas de chiffrement du payload** : Le protocole Web Push exige que le message soit chiffré avec les clés du navigateur (p256dh/auth), ce qui n'est pas fait actuellement

## Solution

Réécrire la fonction `sendWebPush` en utilisant une approche simplifiée qui fonctionne avec Deno :

### Option 1 : Utiliser une librairie Web Push pour Deno

Importer une librairie éprouvée comme `web-push` adaptée pour Deno qui gère correctement :
- L'importation des clés VAPID
- Le chiffrement ECE (Encrypted Content-Encoding)
- La signature JWT

### Option 2 : Implémenter le chiffrement ECE complet

Implémenter manuellement :
- ECDH key agreement avec p256dh
- HKDF key derivation
- AES-128-GCM encryption
- Signature VAPID avec clé importée en format JWK

## Plan de Correction

### Fichier à modifier : `supabase/functions/send-push-notification/index.ts`

1. **Réécrire l'import de la clé privée** en utilisant le format JWK au lieu de PKCS8 brut
2. **Ajouter le chiffrement ECE** pour encoder le payload correctement
3. **Simplifier la signature VAPID** avec une approche JWK

### Changements techniques

```text
┌─────────────────────────────────────────────────────────────────┐
│ Flux actuel (bugué)                                             │
├─────────────────────────────────────────────────────────────────┤
│ Clé privée (base64url) → PKCS8 header hardcodé → importKey FAIL │
│ Payload JSON → envoyé non chiffré → rejeté par FCM              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Flux corrigé                                                    │
├─────────────────────────────────────────────────────────────────┤
│ Clé privée (base64url) → format JWK → importKey OK              │
│ Payload JSON → ECDH + HKDF + AES-GCM → chiffré → FCM accepte    │
└─────────────────────────────────────────────────────────────────┘
```

### Code de la signature VAPID corrigée

Convertir la clé privée en format JWK :
```javascript
const jwk = {
  kty: 'EC',
  crv: 'P-256',
  d: vapidPrivateKey, // base64url direct
  x: publicKeyX,      // extrait de la clé publique
  y: publicKeyY       // extrait de la clé publique
};
const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
```

### Code du chiffrement ECE

```javascript
// 1. Générer une paire de clés éphémère
const ephemeralKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);

// 2. Dériver le secret partagé avec p256dh du navigateur
const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: browserPublicKey }, ephemeralKeys.privateKey, 256);

// 3. Dériver les clés de chiffrement via HKDF
const contentEncryptionKey = await hkdf(sharedSecret, authSecret, 'Content-Encoding: aes128gcm');

// 4. Chiffrer le payload
const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, contentEncryptionKey, payload);
```

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `supabase/functions/send-push-notification/index.ts` | Réécriture complète des fonctions crypto |

## Résultat attendu

Après correction :
- L'edge function pourra signer les JWT VAPID correctement
- Le payload sera chiffré conformément au protocole Web Push
- Les notifications apparaîtront sur le navigateur/mobile

## Test après correction

Relancer le même appel de test :
```json
{
  "user_ids": ["84e72276-2ec0-4ae1-8bd2-25026aa2fa97"],
  "title": "Test Notification",
  "message": "Ceci est un test!",
  "type": "results_added"
}
```
