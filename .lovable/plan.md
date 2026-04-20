
## Meilleure solution recommandée

La meilleure réparation est une correction d’infrastructure, pas une refonte de la fonction :

1. créer/valider un secret `CRON_SECRET` en LIVE,
2. modifier les deux jobs cron existants pour qu’ils appellent l’URL Edge Function de l’environnement LIVE avec le header `x-cron-secret`,
3. conserver les mêmes `jobid` via `cron.alter_job(...)`,
4. lancer un rattrapage manuel,
5. vérifier les écritures dans `arena_recap_runs`.

## Pourquoi c’est la meilleure option

- La fonction `arena-recaps` est déjà prête :
  - elle répond immédiatement avec `EdgeRuntime.waitUntil(...)`,
  - elle supporte déjà `x-cron-secret`,
  - elle utilise déjà `npm:@supabase/supabase-js@2`.
- Donc le problème le plus probable n’est plus le code de la fonction, mais le pointage des jobs cron vers le mauvais environnement ou avec le mauvais mode d’authentification.
- `CRON_SECRET` est préférable à la clé anon :
  - plus simple à gérer,
  - plus sûr,
  - plus facile à révoquer,
  - évite de dépendre d’un long JWT copié en dur.

## Ce qui sera fait

### Étape 1 — Vérifier le mode d’appel actuel
Contrôler les jobs quotidiens et hebdo dans `cron.job` pour confirmer :
- l’URL appelée,
- les headers utilisés,
- les `jobid` existants.

### Étape 2 — Standardiser l’authentification
Créer ou réutiliser un secret LIVE nommé `CRON_SECRET`.

Les jobs enverront :
```text
Content-Type: application/json
x-cron-secret: <CRON_SECRET_LIVE>
```

### Étape 3 — Corriger les deux jobs sans les recréer
Modifier les jobs existants avec `cron.alter_job(...)` au lieu de les supprimer/recréer, afin de :
- garder les mêmes identifiants,
- limiter les risques,
- conserver les schedules déjà en place si souhaité.

### Étape 4 — Pointer explicitement vers la bonne Edge Function LIVE
Mettre dans les deux commandes cron l’URL de `arena-recaps` correspondant strictement à l’environnement LIVE.

Important :
- ne pas recopier une URL depuis TEST,
- ne pas réutiliser un ancien project ref,
- prendre l’URL réellement affichée par l’environnement LIVE.

### Étape 5 — Rattrapage manuel
Déclencher :
- le récap quotidien manquant,
- le récap hebdo manquant.

### Étape 6 — Vérification finale
Contrôler dans `arena_recap_runs` :
- apparition des nouveaux runs,
- `run_type`,
- `target_date`,
- `status`,
- `auth_method`.

## Résultat attendu

Après correction :
- les jobs quotidiens et hebdo appellent bien la fonction LIVE,
- la fonction accepte l’appel via `x-cron-secret`,
- elle répond vite au cron,
- le traitement continue en arrière-plan,
- les exécutions apparaissent dans `arena_recap_runs`,
- le watchdog redevient utile comme filet de sécurité.

## Détails techniques

### Ce qui n’a pas besoin d’être changé
- `supabase/functions/arena-recaps/index.ts` : déjà compatible avec la stratégie recommandée.
- `supabase/config.toml` : `verify_jwt = false` est déjà en place pour `arena-recaps`.
- Le pattern `waitUntil(...)` est déjà implémenté.

### Ce qui devra être modifié
- uniquement les commandes SQL des jobs cron en LIVE,
- éventuellement la création du secret `CRON_SECRET` s’il n’existe pas encore.

### Principe de sécurité retenu
```text
pg_cron LIVE
  -> HTTP POST vers arena-recaps LIVE
  -> header x-cron-secret
  -> réponse immédiate
  -> traitement asynchrone
  -> écriture dans arena_recap_runs
```

## Livraison prévue en mode build
1. vérifier l’état exact des jobs LIVE,
2. préparer les requêtes SQL finales prêtes à coller avec `CRON_SECRET`,
3. indiquer précisément où créer le secret si absent,
4. fournir les requêtes de rattrapage,
5. valider le flux avec les runs enregistrés.
