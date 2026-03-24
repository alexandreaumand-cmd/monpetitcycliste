

# Fix: Recap quotidien timeout après 5 secondes

## Diagnostic

Les cron jobs pointent bien vers `arena-recaps` avec le bon body. Mais les 3 requêtes HTTP émises à 20h00 UTC aujourd'hui ont **toutes timeout à 5 secondes** :

```text
Timeout of 5000 ms reached. Total time: 5001 ms
Timeout of 5000 ms reached. Total time: 5002 ms  
Timeout of 5000 ms reached. Total time: 5000 ms
```

`net.http_post` a un timeout par défaut de 5000 ms. La fonction `arena-recaps` fait de nombreuses requêtes DB (points, bonus, startlist changes, standings, managers...) et dépasse systématiquement ce délai.

## Solution

Modifier les 2 cron jobs pour ajouter le paramètre `timeout_milliseconds` à `net.http_post` (30 secondes).

### Requêtes SQL à exécuter dans Cloud View > Run SQL > Live

```sql
-- Fix daily recap avec timeout 30s
SELECT cron.unschedule('arena-daily-recap');

SELECT cron.schedule(
  'arena-daily-recap',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/arena-recaps',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
    body := '{"type": "daily"}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- Fix weekly recap avec timeout 30s
SELECT cron.unschedule('arena-weekly-recap');

SELECT cron.schedule(
  'arena-weekly-recap',
  '15 20 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/arena-recaps',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
    body := '{"type": "weekly"}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);
```

### Deuxième problème : authentification

La fonction vérifie soit un `x-cron-secret`, soit un token superadmin. Le cron envoie la **clé anon** comme Bearer, qui n'est ni l'un ni l'autre → la fonction retourne 401 (même si le timeout masque cette erreur).

**Deux options** (au choix) :
1. **Option simple** : Ajouter le header `x-cron-secret` dans le cron et configurer le secret `CRON_SECRET` dans l'environnement
2. **Option code** : Modifier `arena-recaps/index.ts` pour accepter la clé anon comme auth valide quand appelé sans user token (ajouter un bypass pour les appels cron)

Je recommande l'**option 2** : modifier la fonction pour détecter l'appel cron (pas de user token valide + clé anon) et le laisser passer. Cela évite de gérer un secret supplémentaire.

### Fichier modifié (option 2)
- `supabase/functions/arena-recaps/index.ts` — ajouter un bypass auth pour les appels cron (vérifier que le token est bien la clé anon du projet)

### Action requise de votre part
- Exécuter les 4 requêtes SQL ci-dessus dans **Cloud View > Run SQL > Live**
- Aucune modification de code n'est nécessaire si vous choisissez l'option 1 avec un CRON_SECRET

