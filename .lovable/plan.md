## Diagnostic

Les 2 mails de ton dernier test sont bien dans la file `pgmq.q_transactional_emails`, mais le **worker qui doit les envoyer ne tourne plus**.

Le cron `process-email-queue` (toutes les 5 s) plante à chaque exécution avec :

```
ERROR: relation "pgmq.q_auth_emails" does not exist
```

Pourquoi : son SQL teste deux files (`q_auth_emails` et `q_transactional_emails`), mais `q_auth_emails` n'a jamais été créée dans le projet TEST. Le `CASE WHEN EXISTS (SELECT 1 FROM pgmq.q_auth_emails ...)` casse avant d'évaluer la branche transactionnelle. Résultat : la fonction `process-email-queue` n'est **jamais appelée**, et les mails restent en `pending` indéfiniment.

Bonus : son `url` pointe encore vers l'ancien projet (`oisfvryhpovwxaxqbmow.supabase.co`) au lieu du projet actuel (`khahpetvqjoyrwambaqn.supabase.co`).

Les migrations correctives précédentes n'ont visiblement pas été exécutées en TEST (le job 24 garde l'ancien `command`).

## Correction

Une seule migration qui fait, dans cet ordre :

1. **Désinscrire** tous les jobs nommés `process-email-queue` (boucle `DO` pour gérer plusieurs occurrences éventuelles).
2. **Recréer** le job avec :
   - URL → `https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/process-email-queue`
   - Condition `WHEN EXISTS` qui ne référence **que** `pgmq.q_transactional_emails` (la seule qui existe).
   - Garde-fou `to_regclass('pgmq.q_auth_emails') IS NOT NULL` au cas où la file auth serait ajoutée plus tard, sans planter si elle n'existe pas.
   - Auth `Bearer` lu depuis `vault.decrypted_secrets` (`email_queue_service_role_key`).

3. **Vérification post-migration** (que je ferai après) :
   - Lire `cron.job` pour confirmer que jobid actuel a la bonne URL.
   - Attendre 10-15 s puis lire `cron.job_run_details` : statut doit être `succeeded`.
   - Lire `email_send_log` : les 2 lignes doivent passer de `pending` à `sent`.
   - Si elles restent `pending` : regarder les logs de l'edge function `process-email-queue` (auth 401/403 = secret du vault à régénérer).

## Fichier touché

- Nouvelle migration SQL (la précédente n'ayant pas pris).
