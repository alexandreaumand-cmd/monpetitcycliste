# Plan post-publish : remettre l'envoi d'emails en état de marche sur LIVE

## Diagnostic complet de LIVE (avant action)

| Élément | État LIVE |
|---|---|
| Domaine email `labordure.app` | ✅ Vérifié au niveau workspace |
| Configuré pour ce projet | ✅ Oui |
| RPC `enqueue_email` | ✅ Existe |
| Queue `pgmq.q_transactional_emails` | ✅ Existe (3 messages bloqués) |
| Queue `pgmq.q_auth_emails` | ❌ N'existe pas |
| DLQ `pgmq.q_transactional_emails_dlq` | ❌ N'existe pas |
| Cron `process-email-queue` (5s) | ✅ Actif **mais plante en boucle** |
| Edge function `process-email-queue` | ❓ Jamais invoquée (aucun log) |
| Toggle "Lovable Emails" sur LIVE | ❓ Probablement off (à confirmer dans Cloud→Emails) |

**Cause racine du blocage** : le cron référence `pgmq.q_auth_emails` qui n'existe pas → erreur SQL toutes les 5s → la fonction `process-email-queue` n'est **jamais appelée** → tous les `pending` restent éternellement en attente.

---

## Étapes post-publish (dans l'ordre)

### Étape 1 — Publier le projet
Clic sur **Publish → Update**. Cela déploie :
- Le code des edge functions (`send-communication-email`, `resend-failed-communication` avec le fix `idempotency_key`)
- Les migrations en attente (refresh standings, alias RPC)
- Les secrets nouvellement ajoutés

⚠️ Cela ne corrigera **pas** automatiquement les problèmes infra ci-dessous.

### Étape 2 — Activer Lovable Emails sur LIVE
Dans **Cloud → Emails** (environnement **LIVE** sélectionné) :
1. Vérifier que `labordure.app` (ou `notify.labordure.app`) est listé comme sender domain actif
2. **Activer** le toggle "Lovable Emails"

Sans ça → erreur `Emails disabled for this project` ou `403 no_matching_sender`.

### Étape 3 — Réparer l'infra email manquante (SQL à exécuter sur LIVE)

Dans **Cloud View → Run SQL** (LIVE sélectionné), exécuter ce bloc :

```sql
-- 3.1 — Créer la queue auth manquante (référencée par le cron)
SELECT pgmq.create('auth_emails');

-- 3.2 — Créer la DLQ transactionnelle manquante
SELECT pgmq.create('transactional_emails_dlq');

-- 3.3 — Vider les 3 messages stuck dans la queue principale
SELECT pgmq.delete('transactional_emails', 1);
SELECT pgmq.delete('transactional_emails', 2);
SELECT pgmq.delete('transactional_emails', 3);

-- 3.4 — Marquer les 3 logs pending comme annulés (ils ne partiront jamais)
UPDATE public.email_send_log
SET status = 'cancelled',
    error_message = 'Annulé : queue non opérationnelle avant correction infra (cron en erreur sur q_auth_emails)'
WHERE status = 'pending';
```

### Étape 4 — Vérifier que le cron tourne enfin

Toujours dans **Run SQL (LIVE)**, attendre ~30s après l'étape 3 puis :

```sql
-- Doit montrer status='succeeded' au lieu de 'failed'
SELECT status, return_message, start_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-email-queue')
ORDER BY start_time DESC
LIMIT 5;
```

✅ Attendu : `status: succeeded`, `return_message: NULL` (queues vides, donc pas d'appel HTTP).

### Étape 5 — Test end-to-end depuis l'UI

1. Aller sur **Super Admin → Communications** sur le LIVE
2. Sélectionner 1 destinataire de test (toi-même)
3. Envoyer un email
4. Dans Run SQL (LIVE), surveiller :

```sql
-- Le log doit passer pending → sent en moins de 30s
SELECT message_id, recipient_email, status, error_message, created_at
FROM email_send_log
ORDER BY created_at DESC
LIMIT 5;
```

✅ Si `status: sent` → tout fonctionne.
❌ Si `status: failed` → lire `error_message`, ce sera probablement :
- `Emails disabled` → étape 2 pas faite
- `no_matching_sender` → mauvais domaine configuré
- `missing idempotency_key` → publish pas fait (code pas à jour)

### Étape 6 — Surveillance

Une fois que ça marche, garder un œil sur :

```sql
SELECT status, COUNT(*) FROM email_send_log
WHERE created_at > now() - interval '1 day'
GROUP BY status;
```

Et la DLQ (qui devrait rester quasi vide) :

```sql
SELECT * FROM pgmq.q_transactional_emails_dlq;
```

---

## Détails techniques

### Pourquoi le cron plante malgré `to_regclass(...) IS NOT NULL`

PostgreSQL parse le SQL **avant** d'évaluer les `CASE/AND` short-circuits. Dès que le planner voit `SELECT 1 FROM pgmq.q_auth_emails`, il vérifie l'existence de la table → erreur fatale. Solution : **créer la queue** (étape 3.1) plutôt que modifier le cron, ce qui évite de toucher à la définition générée par `setup_email_infra`.

### Fichiers code impactés
**Aucun.** Tout le travail est :
- 1 publish
- 1 toggle UI dans Cloud
- 4 requêtes SQL en Cloud View

### Risques
- **Étape 3.1/3.2** : `pgmq.create()` est idempotent côté nom mais lève une erreur si la table existe déjà. Si tu vois `relation already exists`, c'est OK — passer à la suite.
- **Étape 3.3** : si entre temps un autre message arrive, ne supprimer que les `msg_id` 1, 2, 3 (ce sont les seuls actuellement bloqués).
- **Étape 3.4** : `cancelled` n'est utilisé nulle part comme statut bloquant — safe.

---

## Action requise de ta part

1. ✅ Publier
2. ✅ Activer Lovable Emails sur LIVE (Cloud → Emails)
3. ✅ Coller le bloc SQL de l'étape 3 dans Run SQL (LIVE)
4. ✅ Faire un envoi test
5. 📩 Me dire le résultat

Une fois validé sur LIVE, on pourra appliquer la même logique sur TEST si tu veux aussi y tester réellement les envois.
