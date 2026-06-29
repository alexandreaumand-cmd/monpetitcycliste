## Diagnostic

L'enchère du tour 1 de CopaTOUR (`scheduled`, `opens_at = 2026-06-29 18:00 UTC`) aurait dû être ouverte automatiquement il y a plus d'une heure par le cron `auto-open-scheduled-auctions` (qui tourne toutes les 5 min et s'exécute avec succès).

**Cause racine :** la commande du cron pointe vers une URL de projet erronée :

```
https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/auto-open-scheduled-auctions
```

au lieu du projet réel. Résultat : la requête HTTP part bien (donc `succeeded` côté `cron.job_run_details`), mais elle n'atteint jamais notre edge function (zéro log côté `auto-open-scheduled-auctions`).

Le même problème touche le cron `arena-pronostic-reminder`. Les autres crons HTTP utilisent la bonne URL.

## Plan de correction

1. **Réécrire le cron `auto-open-scheduled-auctions`** via `cron.schedule` pour pointer vers la bonne URL du projet (en gardant `*/5 * * * *` et le header `Authorization: Bearer <anon>` du projet courant).
2. **Réécrire le cron `arena-pronostic-reminder`** de la même manière (même bug, même correctif).
3. **Déclencher manuellement** `auto-open-scheduled-auctions` une fois pour ouvrir immédiatement le tour 1 de CopaTOUR (et toute autre enchère `scheduled` dont `opens_at` est dépassé), sans attendre le prochain tick à xx:25.
4. **Vérifier** : l'enchère CopaTOUR passe en `statut = 'open'`, un log apparaît côté edge function, et les membres reçoivent la notification d'ouverture.

## Détails techniques

- Migration SQL : `cron.unschedule(...)` puis `cron.schedule(...)` avec le bon `url` (projet courant) pour les deux jobs concernés. Pas de changement de planning ni de body.
- Aucun changement de code applicatif nécessaire — l'edge function `auto-open-scheduled-auctions` fonctionne déjà correctement.
