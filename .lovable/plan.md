# Diagnostic : pourquoi les emails ne partent pas en LIVE

## Ce qui se passe

1. Tu envoies l'email → la fonction `send-communication-email` met bien les 2 emails dans la queue interne (`transactional_emails`) et crée le batch dans l'historique. ✅
2. Un **cron** doit ensuite, toutes les 5 secondes, appeler la fonction `process-email-queue` qui dépile la queue et envoie réellement les emails via Resend.
3. **Ce cron est cassé en LIVE** depuis longtemps :
   - Il appelle une URL qui pointe vers **un autre projet Supabase** (`oisfvryhpovwxaxqbmow` au lieu de `khahpetvqjoyrwambaqn`).
   - Avant même d'appeler l'URL, il interroge une queue `auth_emails` qui n'existe pas en LIVE → le cron plante à chaque exécution avec l'erreur `relation "pgmq.q_auth_emails" does not exist`.

Résultat : la queue grossit, les lignes dans `email_send_log` restent au statut `pending`, et aucun email ne part jamais.

## Vérifications faites

- `pgmq.metrics('transactional_emails')` → 2 messages en attente, plus vieux ~5 min (= tes 2 emails).
- `email_send_log` → tes 2 envois sont en `status = pending` sans `error_message`.
- `cron.job_run_details` → toutes les exécutions du job `process-email-queue` sont en `failed` avec l'erreur ci-dessus.
- `pgmq.list_queues()` → seule la queue `transactional_emails` existe (pas de `auth_emails`).
- Le secret `email_queue_service_role_key` existe bien dans le Vault.
- La fonction `process-email-queue` existe bien dans le code et est déployée sur le bon projet.

## Correctif proposé

Une **migration** qui réécrit le job cron `process-email-queue` :
- Remplace l'URL par celle du bon projet : `https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/process-email-queue`.
- Supprime la condition sur `pgmq.q_auth_emails` (queue inexistante) et garde seulement le check sur `pgmq.q_transactional_emails`.
- Conserve la garde `retry_after_until` et le secret depuis `vault`.
- Conserve la fréquence de 5 secondes.

Le cron sera reprogrammé via `cron.schedule(...)` (qui fait un upsert sur le nom du job).

## Après application

Dès que le cron tournera correctement (5 sec plus tard), il va :
1. Voir les 2 messages en attente dans la queue.
2. Appeler `process-email-queue` qui les dépile et les envoie via Resend.
3. Tu devrais recevoir les 2 emails dans la foulée et leur statut passera de `pending` à `sent` dans l'historique.

## Détails techniques

- Fichier touché : nouvelle migration SQL uniquement (aucun code TS modifié).
- Aucune action côté Test n'est nécessaire — le bug est spécifique au cron LIVE.
- Optionnel à valider : faut-il aussi vérifier/corriger le job en TEST ? À ma connaissance les emails fonctionnaient déjà en TEST, donc non par défaut.

## Question

Veux-tu que je vérifie aussi d'éventuels autres jobs cron en LIVE qui pointeraient vers le mauvais projet (`oisfvryhpovwxaxqbmow`) pendant qu'on y est ?
