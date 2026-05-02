
## Diagnostic

L'envoi d'emails ne fonctionne plus en LIVE car **tous les jobs `pg_cron` du projet LIVE pointent vers l'URL du projet TEST**.

### Preuves recueillies

- 8 emails sont coincés en `pending` dans `email_send_log` (LIVE), et 8 messages dans `pgmq.q_transactional_emails` avec `read_ct = 0` (jamais lus).
- Tous les `vt` sont expirés : les messages sont éligibles à la lecture.
- Le job `process-email-queue` est actif (toutes les 5 s) et `net._http_response` retourne bien `200 {"processed":0}`.
- Le ref Supabase **LIVE** est `oisfvryhpovwxaxqbmow` (visible dans `function_edge_logs`), mais la commande du cron contient :
  ```
  url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/process-email-queue'
  ```
  → c'est le ref **TEST**.
- Même problème sur `arena-pronostic-reminder` (l'`Authorization` contient en clair l'anon key du projet TEST).

### Conséquence

Les crons LIVE appellent les Edge Functions du projet **TEST**. Côté TEST :
- la queue d'emails est vide → `processed:0` est renvoyé → le cron LIVE croit que tout va bien ;
- côté LIVE, aucun message n'est jamais consommé, la queue grossit indéfiniment et aucun email n'est envoyé.

C'est une régression typique des migrations SQL qui hardcodent une URL Supabase : la migration créée en TEST est rejouée telle quelle en LIVE.

## Plan de correction

### 1. Migration : rendre les crons indépendants de l'environnement

Créer une migration qui :

1. **Stocke le ref du projet courant** dans une fonction utilitaire (pas dans la SQL des crons), par ex. `public.current_project_ref()` qui renvoie un `text`.
   - Implémentation pragmatique : utiliser un secret Vault `project_ref` (déjà géré projet par projet, ne sera pas répliqué de TEST à LIVE).
   - Variante : lire `current_setting('app.settings.project_ref')` configuré côté projet.
2. **Supprime puis recrée chaque cron impacté** en construisant l'URL dynamiquement :
   ```sql
   format('https://%s.supabase.co/functions/v1/process-email-queue', public.current_project_ref())
   ```
3. Cibles à recréer (à confirmer en listant `cron.job` dans les deux environnements, candidats déjà identifiés) :
   - `process-email-queue`
   - `arena-pronostic-reminder`
   - `auto-open-scheduled-auctions`
   - `startlist-tracker`
   - tout autre job dont la commande contient `khahpetvqjoyrwambaqn.supabase.co` ou `oisfvryhpovwxaxqbmow.supabase.co`
4. Pour l'`Authorization` : remplacer l'anon key hardcodée par une lecture du Vault (`service_role_key` ou `anon_key` selon l'usage de la fonction). Le secret `email_queue_service_role_key` existe déjà en LIVE et est utilisé correctement par `process-email-queue` — appliquer le même pattern aux autres jobs.

### 2. Provisionnement des secrets Vault par environnement

Avant que la migration ne tourne en LIVE :

- Vérifier que les secrets Vault `email_queue_service_role_key` et `project_ref` existent dans **chaque** environnement (TEST + LIVE) avec les bonnes valeurs locales.
- Documenter ces deux secrets dans le README admin pour qu'ils soient recréés en cas de restauration.

### 3. Rejouer les emails en attente

Une fois les crons fixés et publiés en LIVE :

- Les 8 messages déjà en queue ont un `queued_at` > 60 min (TTL transactional). À l'exécution suivante, le worker les enverra dans la DLQ (`TTL exceeded`) sans les envoyer.
- Pour ne pas perdre les communications déjà composées, deux options :
  - **A — Rallonger le TTL ponctuellement** : insérer/mettre à jour `email_send_state` (id=1) avec `transactional_email_ttl_minutes = 10080` (7 j) avant l'exécution, puis revenir à 60 min.
  - **B — Re-publier les messages** : appeler le bouton « Renvoyer » côté Super Admin Communications (la fonction `resend-failed-communication` existe déjà) après avoir manuellement vidé la queue.
- Recommandation : option A, plus simple et sans intervention côté UI.
- Aussi : créer/peupler la ligne `email_send_state (id=1)` avec les valeurs par défaut (`batch_size=10`, `send_delay_ms=200`, `auth_email_ttl_minutes=15`, `transactional_email_ttl_minutes=60`) — la table est actuellement vide en LIVE, ce qui n'empêche pas le code de fonctionner mais le rend moins prévisible.

### 4. Audit & garde-fous

- Ajouter à la page **Super Admin → Cron Jobs** (déjà en place) :
  - une colonne « URL cible » extraite de `cron.job.command`
  - un badge rouge si l'URL ne correspond pas au project ref courant
- Ajouter un test SQL idempotent dans la migration qui `RAISE EXCEPTION` si un cron contient une URL hardcodée appartenant à un autre projet.

### 5. Vérification après publication

1. Confirmer dans `cron.job` (LIVE) que toutes les commandes contiennent bien `oisfvryhpovwxaxqbmow`.
2. Vérifier dans `function_edge_logs` (LIVE) qu'on voit enfin des appels POST vers `…/process-email-queue` avec status 200.
3. Vérifier que `email_send_log` passe les 8 entrées de `pending` à `sent`.
4. Envoyer un email de test depuis Super Admin Communications.

## Détails techniques

```sql
-- 1. Helper
create or replace function public.current_project_ref()
returns text language sql stable as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'project_ref'
$$;

-- 2. Recréation type pour process-email-queue
select cron.unschedule('process-email-queue');
select cron.schedule(
  'process-email-queue',
  '5 seconds',
  format($job$
    SELECT CASE
      WHEN (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now()
        THEN NULL
      WHEN (
        EXISTS (SELECT 1 FROM pgmq.q_transactional_emails LIMIT 1)
        OR EXISTS (SELECT 1 FROM pgmq.q_auth_emails LIMIT 1)
      )
        THEN net.http_post(
          url := 'https://%s.supabase.co/functions/v1/process-email-queue',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
              SELECT decrypted_secret FROM vault.decrypted_secrets
              WHERE name = 'email_queue_service_role_key'
            )
          ),
          body := '{}'::jsonb
        )
    END;
  $job$, public.current_project_ref())
);
```

(La même mécanique sera appliquée aux 3 autres crons.)

## Hors-scope

- Migration vers un système de cron Lovable « managed » (à envisager plus tard).
- Refonte du système d'emails — la file et le worker fonctionnent, seul l'aiguillage est cassé.
