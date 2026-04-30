
## Constat

Les mails d'inscription "fonctionnent" en LIVE non pas via notre système custom (`auth-email-hook` + queue pgmq + `process-email-queue`), mais via les **templates auth par défaut de Lovable** qui envoient directement, sans passer par la queue.

Preuve :
- `email_send_log` LIVE ne contient **aucun** log de type signup/recovery/magiclink, uniquement des `communication_general` en `pending`.
- Aucun log côté edge functions `auth-email-hook` ni `process-email-queue` en LIVE.
- Le cron `process-email-queue` se déclenche bien toutes les 5s, mais l'appel HTTP à la fonction reçoit `401 UNAUTHORIZED_LEGACY_JWT` — la JWT stockée dans le vault (`email_queue_service_role_key`) est l'ancien format que Supabase rejette désormais.

Donc le système de queue n'a **jamais réellement tourné en LIVE**. Les communications resteront bloquées en `pending` tant que le cron ne peut pas appeler la fonction.

## Solution

Reproduire en LIVE le chemin qui fonctionne déjà en TEST pour la queue :
1. La fonction `process-email-queue` doit être joignable par le cron interne (sans JWT vérifié, ou avec une clé valide).
2. Une fois la fonction joignable, elle pop les messages et appelle `sendLovableEmail` qui utilise `LOVABLE_API_KEY` (déjà provisionné) pour envoyer via Lovable Emails.

Le changement de `verify_jwt = false` sur `process-email-queue` dans `supabase/config.toml` a déjà été fait dans la conversation précédente. Il reste à publier et à valider que la chaîne complète fonctionne.

## Étapes

### 1. Publier le projet (frontend + config edge functions)

Le `supabase/config.toml` modifié (`process-email-queue` → `verify_jwt = false`) doit être déployé en LIVE. La fonction reste sécurisée car :
- Elle n'est appelée que par le cron interne via `net.http_post`.
- Elle ne lit que la queue et envoie les mails déjà préparés ; aucun input client.

### 2. Vérifier que le cron tourne sans erreur après publish

Dans Cloud (LIVE) → Run SQL :
```sql
SELECT j.jobname, d.status, d.return_message, d.start_time
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname = 'process-email-queue'
ORDER BY d.start_time DESC LIMIT 5;
```
Attendu : 5 lignes `succeeded`.

```sql
SELECT id, status_code, left(content::text, 100) AS content, created
FROM net._http_response
ORDER BY created DESC LIMIT 5;
```
Attendu : `status_code = 200` (plus de 401).

### 3. Vérifier que les 5 mails en attente partent

```sql
SELECT status, COUNT(*) FROM email_send_log GROUP BY status;
```
Attendu : `pending` → 0, `sent` → 5 (ou un mix avec `failed` si Lovable Emails refuse certains).

```sql
SELECT 'q_transactional_emails', COUNT(*) FROM pgmq.q_transactional_emails;
```
Attendu : 0.

### 4. Faire un envoi test depuis l'UI

Depuis Super Admin → Communications → Nouvel envoi : envoyer à un destinataire. Vérifier que l'historique passe en `1 envoyé` (et non plus `1 en attente`) en moins de 30 s.

### 5. Plan de repli si ça échoue encore

Si après publish on a toujours 401 ou si `process-email-queue` ne reçoit toujours rien :
- Inspecter `supabase--edge_function_logs` (LIVE) sur `process-email-queue` pour voir le vrai code retour.
- Si la fonction n'est pas déployée en LIVE, la redéployer manuellement.
- Si le secret `LOVABLE_API_KEY` manque côté LIVE, le faire ajouter (normalement provisionné automatiquement).

## Détails techniques

**Fichiers concernés (déjà modifiés)** :
- `supabase/config.toml` : `[functions.process-email-queue] verify_jwt = false`

**Aucun changement de code applicatif nécessaire** — `send-communication-email` est déjà bon (il enqueue correctement, on l'a vu dans la queue avec 5 messages).

**Pourquoi ne pas réparer le secret `email_queue_service_role_key` du vault** :
- C'est faisable mais demande de récupérer la nouvelle service role key et de la coller dans le vault via SQL.
- L'option `verify_jwt = false` est plus simple, sûre dans ce contexte (cron interne uniquement), et alignée avec ce que font la plupart des fonctions cron Lovable (`arena-recap-watchdog`, `auto-open-scheduled-auctions`, etc. qui sont déjà toutes en `verify_jwt = false`).

**Validation finale attendue** : l'historique des envois LIVE doit afficher `X envoyé` au lieu de `X en attente`, et les destinataires doivent recevoir le mail dans leur boîte.
