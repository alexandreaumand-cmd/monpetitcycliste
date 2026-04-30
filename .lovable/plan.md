## Diagnostic

L'envoi d'emails échoue en TEST avec cette erreur côté `process-email-queue` :

```
Email API error: 400 {"type":"missing_parameter",
  "message":"Missing run_id or idempotency_key",
  "details":"Auth emails require run_id. App emails can omit run_id by providing
             idempotency_key with purpose=transactional."}
```

Le cron `process-email-queue` fonctionne maintenant (le problème pgmq précédent est résolu), mais l'API Lovable Email rejette tous les emails communication parce que le payload enfilé n'a **ni `run_id` ni `idempotency_key`**.

### Cause exacte

Dans `supabase/functions/send-communication-email/index.ts` (ligne 274), l'appel à `enqueue_email` construit un payload avec :
- `purpose: 'transactional'`
- `message_id` (UUID interne, utilisé pour la déduplication LOG côté worker)
- ❌ pas de `idempotency_key`
- ❌ pas de `run_id` (normal, c'est une app email pas une auth email)

L'API Lovable exige pour les emails `transactional` qu'on fournisse `idempotency_key`. Le worker `process-email-queue` transmet bien `payload.idempotency_key` à `sendLovableEmail` (ligne 260), mais celui-ci est `undefined` → 400.

Le même bug existe dans `supabase/functions/resend-failed-communication/index.ts` (ligne 154).

À l'inverse, `auth-email-hook` fournit bien `run_id` → les emails auth fonctionnent.

## Correction proposée

### 1. `send-communication-email/index.ts`

Ajouter `idempotency_key` dans le payload `enqueue_email`. Le plus simple et le plus correct est de réutiliser `message_id` (qui est déjà un UUID unique par destinataire et par envoi) :

```ts
payload: {
  message_id: messageId,
  idempotency_key: messageId,   // ← AJOUT
  to: r.email,
  ...
}
```

Cela garantit l'idempotence côté Lovable Email (un même message ne sera pas envoyé deux fois si la queue retente après un crash réseau).

### 2. `resend-failed-communication/index.ts`

Même correctif : ajouter `idempotency_key: messageId` (en utilisant un nouveau UUID puisqu'on rejoue un échec).

### 3. Purger les messages bloqués dans la queue TEST

Les 2 messages actuellement coincés (`msg_id: 7` et `msg_id: 8`) vont continuer à boucler jusqu'à atteindre `MAX_RETRIES=5` puis tomber en DLQ. Deux options :

- **A. Laisser faire** : ils tomberont en DLQ naturellement après quelques minutes (5 tentatives × ~5s = ~25s, mais le compteur `failed_attempts` est lu depuis `email_send_log`, donc ça arrivera très vite). Une fois redéployé, les nouveaux envois passeront.
- **B. Les supprimer manuellement** via Cloud → Run SQL en TEST avec `pgmq.delete('transactional_emails', 7)` et `pgmq.delete('transactional_emails', 8)` pour repartir propre.

Je recommande **B** pour avoir une queue propre tout de suite.

## Fichiers modifiés

```
supabase/functions/send-communication-email/index.ts   (+1 ligne)
supabase/functions/resend-failed-communication/index.ts (+1 ligne)
```

## Test après déploiement

1. Renvoyer un mail test depuis `/dashboard/super-admin/communications` en TEST.
2. Vérifier dans `email_send_log` que le statut passe à `sent` (et non `failed`).
3. Vérifier la réception de l'email côté boîte de réception.

Aucune migration SQL nécessaire, aucun changement d'infrastructure.
