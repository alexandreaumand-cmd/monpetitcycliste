# Problème

Les emails manuels (campagnes "Communications") échouent systématiquement avec l'erreur API :

> `400 {"type":"missing_unsubscribe","message":"Transactional emails must include an unsubscribe_token"}`

Tous les envois finissent en `failed` puis `dlq` après 5 retries — donc aucun mail n'arrive dans la boîte des destinataires. Les mails automatiques (enchères, auth) fonctionnent.

# Cause racine

Les deux flux passent par la même file `transactional_emails` traitée par `process-email-queue`, qui transmet `payload.unsubscribe_token` à l'Email API.

- **`send-transactional-email`** (mails auto) : génère un token, le stocke dans `email_unsubscribe_tokens`, et **l'inclut dans le payload de la file** (`unsubscribe_token: unsubscribeToken`). ✅
- **`send-communication-email`** (mails manuels) : génère bien un token et l'insère dans `email_unsubscribe_tokens`, mais **ne l'ajoute pas au payload** envoyé à `enqueue_email`. Le token n'est utilisé que pour construire l'URL HTML. ❌

L'Email API exige le champ top-level `unsubscribe_token` pour tout envoi `purpose: 'transactional'` → 400 systématique.

# Correction

Dans `supabase/functions/send-communication-email/index.ts`, à la construction de `queuePayload` (autour de la ligne 300), ajouter le champ `unsubscribe_token: token` au payload (le token existe déjà ligne 277).

```ts
const queuePayload = {
  message_id: messageId,
  idempotency_key: messageId,
  unsubscribe_token: token,   // ← AJOUT
  to: r.email,
  from: `${SITE_NAME} <contact@${FROM_DOMAIN}>`,
  ...
};
```

Puis redéployer la fonction `send-communication-email`.

# Vérification

1. Envoyer un email manuel test depuis Communications → Nouvel envoi (1 destinataire).
2. Vérifier dans `email_send_log` que le statut passe à `sent`/`delivered` au lieu de `failed`.
3. Confirmer la réception dans la boîte.
