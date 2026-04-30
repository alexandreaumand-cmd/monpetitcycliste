## Objectif

Permettre au super-admin de choisir, dans l'onglet **Nouvel envoi**, une date + heure d'envoi programmé. Si renseignée, l'email part à ce moment-là ; sinon, comportement actuel (envoi immédiat).

## Approche — pourquoi le cron ne change (presque) pas

Le système actuel utilise déjà une file **pgmq** dépilée en boucle par le cron `process-email-queue`. pgmq supporte nativement un **délai d'envoi** : un message avec `delay` (timestamp futur) reste invisible dans la queue jusqu'à l'heure prévue, puis devient consommable normalement.

Donc :
- Le **cron reste identique** (même fréquence, même fonction).
- On change uniquement la fonction d'enfilage pour passer un `delay` quand une date est fournie.
- Pas de table de scheduling séparée à maintenir, pas de nouveau cron.

## UI — `SendCommunicationForm.tsx`

Nouvelle carte « 4. Programmation (optionnel) » avant le bouton Envoyer :

- Toggle / switch : « Envoyer maintenant » (par défaut) vs « Programmer l'envoi »
- Si programmé :
  - Date picker (shadcn Calendar dans Popover) — futur uniquement
  - Input heure (HH:mm), fuseau local du navigateur
  - Affichage récapitulatif : « Envoi prévu le 12 mai 2026 à 09:00 (heure locale) »
  - Validation : la date/heure doit être ≥ maintenant + 2 minutes
- Le libellé du bouton devient « Programmer l'envoi à … » au lieu de « Envoyer à N destinataires »
- Le dialog de confirmation reflète l'heure programmée

Le `handleSend` envoie un champ supplémentaire `scheduled_at` (ISO string) ou `null`.

## Backend — `send-communication-email/index.ts`

1. Accepter `scheduled_at?: string | null` dans le body.
2. Validation : si fourni, doit être un ISO valide ≥ now + 60s, ≤ now + 90 jours.
3. Calculer `delaySeconds = max(0, floor((scheduled_at - now) / 1000))`.
4. Au moment de l'enqueue :
   - Conserver `email_send_log` en `status='pending'` (existant), mais ajouter `scheduled_at` dans `metadata`.
   - Remplacer l'appel `rpc('enqueue_email', …)` par un appel direct à `pgmq.send(queue, payload, delay)` quand `delaySeconds > 0`. Sinon, garder le chemin actuel (rétrocompat).
5. Stocker `scheduled_at` aussi dans `communication_batches` (nouvelle colonne) pour l'historique.

### Migration DB

```sql
ALTER TABLE public.communication_batches
  ADD COLUMN scheduled_at timestamptz NULL;
```

(Pas de modif de `email_send_log` — `scheduled_at` y va dans `metadata`.)

### Accès à pgmq.send

`enqueue_email` ne supporte pas le delay. Deux options :
- **A** (préférée) : créer une RPC wrapper `enqueue_email_at(queue_name text, payload jsonb, send_at timestamptz)` qui appelle `pgmq.send(queue, payload, send_at)`. Granted à `service_role`.
- **B** : étendre `enqueue_email` avec un 3e paramètre optionnel.

→ Je pars sur **A** pour ne pas casser les autres appelants d'`enqueue_email`.

```sql
CREATE OR REPLACE FUNCTION public.enqueue_email_at(
  queue_name text, payload jsonb, send_at timestamptz
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq
AS $$
DECLARE msg_id bigint;
BEGIN
  SELECT pgmq.send(queue_name, payload, send_at) INTO msg_id;
  RETURN msg_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.enqueue_email_at(text,jsonb,timestamptz) TO service_role;
```

## Historique

`CommunicationHistoryList.tsx` : afficher un badge « Programmé » + l'heure prévue quand `scheduled_at` est dans le futur (lecture simple, hors scope d'écriture).

## Annulation (hors scope cette itération)

Ne PAS gérer l'annulation d'un envoi programmé dans cette première passe. Une fois en queue avec délai, il part. Ajout possible plus tard via `pgmq.delete(queue, msg_id)` si tu le veux.

## Fichiers touchés

- `src/components/admin/communications/SendCommunicationForm.tsx` (UI date/heure + payload)
- `supabase/functions/send-communication-email/index.ts` (validation + branche scheduled)
- `src/components/admin/communications/CommunicationHistoryList.tsx` (badge programmé — read-only)
- 1 migration : colonne `scheduled_at` + fonction `enqueue_email_at`

## Test

1. Créer un envoi programmé à now+3min avec 1 destinataire (toi).
2. Vérifier que `email_send_log` est `pending` et que pgmq montre `vt` futur.
3. Attendre : le cron passe toutes les minutes, le message devient visible à T+3min, est traité, statut `sent`.
4. Vérifier l'envoi immédiat (sans date) — non régression.
