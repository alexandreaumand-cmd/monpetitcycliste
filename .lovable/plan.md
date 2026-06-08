# Corriger le statut "en attente" des communications déjà envoyées

## Cause

Dans `supabase/functions/process-email-queue/index.ts`, après envoi réussi, le worker fait `insert({ status: 'sent', ... })` au lieu de mettre à jour la ligne `pending` pré-créée par `send-communication-email`. Cette ligne `pending` reste donc en base avec son `metadata.batch_id`, et c'est celle que `useCommunicationBatches` compte → l'UI affiche "1 en attente" alors que le mail est livré.

Même problème côté chemin d'échec (rate_limited / failed) : nouvelles insertions au lieu d'updates, donc les lignes `pending` ne basculent jamais.

## Correction

Dans `supabase/functions/process-email-queue/index.ts`, remplacer les `insert` d'`email_send_log` par une logique **update-if-exists, insert-otherwise**, gardée par `message_id` :

1. **Succès (ligne ~271)** : `update({ status: 'sent', sent_at: now })` sur la ligne avec ce `message_id`. Si aucune ligne n'existe (cas legacy / autres flows sans pré-insertion), faire un `insert` en fallback.
2. **Rate-limited (ligne ~298)** : `update({ status: 'rate_limited', error_message })` puis fallback `insert`.
3. **Failed définitif / DLQ** : même logique d'update vers `failed`.
4. Garder le `metadata.batch_id` existant (un `update` ne le touche pas).

Le guard anti-doublon ligne 222-246 reste valide : il continue de chercher `status='sent'`.

## Étapes

1. Modifier `supabase/functions/process-email-queue/index.ts` (3 endroits : succès, rate-limited, failed).
2. Redéployer la fonction `process-email-queue`.
3. **Migration de rattrapage (one-shot SQL)** : pour les `email_send_log` où il existe à la fois une ligne `pending` et une ligne `sent`/`failed` avec le même `message_id`, passer la ligne `pending` à `sent` (en gardant son `metadata.batch_id`) puis supprimer le doublon orphelin. Cela corrigera l'affichage des batchs déjà envoyés (dont celui du 7 juin 14:14).

## Vérification

- Renvoyer un test via "Nouvel envoi" → la ligne doit passer directement de `pending` à `sent`, et le badge dans Historique doit afficher "1 envoyé" (0 en attente).
- Vérifier les batchs historiques après migration : plus de "en attente" sur les envois déjà livrés.

## Hors-scope

Pas de changement UI (`useCommunicationBatches.ts`), pas de changement à `send-communication-email`.
