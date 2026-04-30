# Réparer l'envoi d'emails en TEST

## Diagnostic

Le cron `process-email-queue` (jobid 24) plante toutes les 5 secondes :

```
ERROR: relation "pgmq.q_auth_emails" does not exist
```

Sa définition contient aussi une URL pointant vers un ancien projet
(`oisfvryhpovwxaxqbmow.supabase.co`) au lieu du projet actuel.

## Blocage

Le job appartient au rôle `postgres`. Les outils SQL utilisés depuis Lovable
tournent en `supabase_read_only_user`, qui n'a ni le droit de modifier le
job (`cron.alter_job` → "Job 24 does not exist or you don't own it"), ni de
le supprimer (`cron.unschedule(24)` → idem), ni de le mettre à jour
directement (UPDATE → permission denied).

`cron.unschedule('process-email-queue')` renvoie `true` mais ne fait rien,
et `cron.schedule(...)` renvoie un id sans créer de nouveau job.

→ **Impossible de réparer le cron depuis cette session.**

## Action manuelle requise (à faire par l'utilisateur)

L'utilisateur doit ouvrir **Cloud → Run SQL** (avec l'environnement **TEST**
sélectionné) et exécuter le script SQL fourni.
