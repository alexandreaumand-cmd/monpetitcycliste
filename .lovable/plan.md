# Diagnostic

Les emails ne partent jamais : ils s'accumulent dans la file `pgmq.q_transactional_emails` sans jamais être lus.

**Constats :**
- 5 messages en attente depuis le 30 avril → 13 mai. Tous ont `read_ct = 0` : aucun worker ne les a jamais consommés.
- L'edge function `process-email-queue` est OK et déployée.
- L'edge function `send-communication-email` enfile correctement les emails (statut `pending` créé dans `email_send_log`, message inséré dans pgmq).
- Le cron `process-email-queue` (toutes les 5 secondes) est bien actif (`active = true`) et la condition de présence en file est bien satisfaite.

**Cause racine identifiée :**
Le cron job appelle la mauvaise URL Supabase :

```
url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/process-email-queue'
```

Or le projet Lovable Cloud actuel a pour ref `oisfvryhpovwxaxqbmow`. L'URL pointe donc vers **un autre projet Supabase** (probablement un ancien projet ou un projet de test). Résultat : toutes les 5 secondes, le cron envoie un POST dans le vide (ou vers un projet qui n'a pas la même fonction / pas la même clé), et la file ne se vide jamais.

C'est aussi la raison pour laquelle l'historique affiche systématiquement "X en attente" pour tous les envois récents.

# Plan de correction

## Étape 1 — Corriger l'URL du cron job (migration SQL)

Mettre à jour le cron `process-email-queue` pour qu'il pointe vers le bon projet :

- Remplacer `khahpetvqjoyrwambaqn.supabase.co` par `oisfvryhpovwxaxqbmow.supabase.co` dans la commande du cron.
- Conserver tout le reste à l'identique (condition d'arrêt si rate-limited, vérification de présence en file, header Authorization avec la clé service role lue depuis le vault).
- Réalisé via `cron.unschedule` + `cron.schedule` (ou `cron.alter_job`) dans une migration.

## Étape 2 — Vérifier que le secret `email_queue_service_role_key` est bien la clé service role du projet actuel

- Le cron lit `email_queue_service_role_key` depuis `vault.decrypted_secrets`.
- Si cette clé correspond encore à l'ancien projet `khahpetv…`, le `process-email-queue` du bon projet renverra 401/403 et la file restera bloquée.
- À vérifier dans une seconde requête / migration ; si nécessaire, mettre à jour le secret avec la clé service role du projet `oisfvryhpovwxaxqbmow`.

## Étape 3 — Vider/relancer les messages déjà en attente

Une fois le cron corrigé, les 5 messages historiques seront naturellement consommés au prochain tick (5 s) puisque `read_ct = 0` et `vt` est dans le passé. Aucun replay manuel n'est nécessaire.

Cas particulier : le message programmé du 2 mai ("Teste envoie programmé…") sera envoyé immédiatement (date de programmation déjà passée). À confirmer avec toi : on le laisse partir, ou on le supprime de la file avant de relancer ?

## Étape 4 — Vérification post-correction

- Relire `pgmq.q_transactional_emails` : doit être vide en quelques secondes.
- Relire `email_send_log` : les messages concernés doivent passer de `pending` à `sent`.
- Consulter les logs de `process-email-queue` pour confirmer l'absence d'erreurs 401/403/429.

# Hors scope

- Pas de modification de `send-communication-email` ni de `process-email-queue` (le code est correct).
- Pas de modification de l'UI Communications.
- Pas de changement du domaine d'envoi ni du provider email.

# Question à clarifier

Veux-tu que j'envoie le message historique programmé du 2 mai 2026 dès la correction appliquée, ou que je le supprime de la file avant ?
