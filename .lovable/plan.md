## Diagnostic

### 1. Pourquoi le récap hebdo n'a pas été envoyé hier (dimanche 26/04)

J'ai inspecté le LIVE :

- **Le cron a bien tiré** : `cron.job_run_details` montre que le job `arena-weekly-recap` (jobid 23) a été exécuté dimanche 26/04 à 20:15 UTC avec statut `succeeded` (HTTP envoyé à l'edge function).
- **Mais rien n'a été produit** : 
  - 0 ligne dans `arena_recap_runs` pour `run_type = 'weekly'` (jamais, depuis le début)
  - 0 message `arena_messages` contenant "Bilan de la semaine" depuis 1 mois
  - aucun log côté `arena-recaps`
- **Le récap quotidien fonctionne** sur le même cron, même secret, même fonction → l'auth et le routage sont OK.

**Cause racine probable** : la fonction `sendWeeklyRecap` est nettement plus lourde que `sendDailyRecap` (RPC `get_weekly_top_riders` + RPC `get_daily_points_by_manager` sur 7 jours + requête `bonus_points` + requête `upcoming_races` + push notifications), et elle est exécutée en **boucle séquentielle sur les 12 ligues actives**. Bien que la fonction utilise `EdgeRuntime.waitUntil`, le runtime Edge tue le worker au bout d'environ 150s : la boucle est interrompue avant d'atteindre l'`INSERT` final dans `arena_recap_runs` (ligne 140) → silence total côté audit, et aucun message n'a le temps d'être produit.

### 2. Pourquoi l'horaire ne correspond pas

Les jobs cron pg_cron tournent en **UTC**, pas en heure de Paris :

| Job | Schedule actuel | Heure UTC | Heure Paris (CEST) |
|---|---|---|---|
| arena-daily-recap | `0 20 * * *` | 20:00 | **22:00** |
| arena-weekly-recap | `15 20 * * 0` | 20:15 dimanche | **22:15 dimanche** |

Pour obtenir **20:30 Paris (CEST)**, il faut programmer à **18:30 UTC** d'avril à octobre. En hiver (CET) ce sera 19:30 Paris — voir note ci-dessous.

## Plan d'action

### Étape 1 — Reprogrammer les crons à 20h30 Paris

Via `cron.alter_job` (préserve les jobids 22 et 23, conformément au standard projet) :

- `arena-daily-recap` → `30 18 * * *` (18:30 UTC = 20:30 Paris CEST, tous les jours)
- `arena-weekly-recap` → `35 18 * * 0` (18:35 UTC dimanche, 5 min après le quotidien pour éviter une collision sur les ressources Edge)

Note timezone : pg_cron ne supporte pas nativement les fuseaux. En heure d'hiver (CET, fin oct → fin mars), les récaps tomberaient à 19:30 Paris. Si l'horaire 20:30 doit rester strict toute l'année, je peux soit :
- (option A, recommandée) garder un schedule fixe en UTC et ajuster manuellement 2× par an aux changements d'heure
- (option B) faire tourner le cron à 18:30 ET 19:30 UTC avec un garde-fou côté fonction qui vérifie l'heure de Paris

À confirmer après approbation. Par défaut je pars sur l'option A (CEST = la majorité de la saison cyclisme).

### Étape 2 — Fixer le récap hebdo pour qu'il aille au bout

Modifier `supabase/functions/arena-recaps/index.ts` :

1. **Paralléliser le traitement des ligues** dans `processRecaps` avec `Promise.allSettled` (au lieu de la boucle `for` séquentielle). Sur 12 ligues, ça divise le temps total par ~10.
2. **Découpler les push notifications** : les envoyer en `Promise.allSettled` plutôt que `await` séquentiel à la fin de `sendWeeklyRecap`.
3. **Logger l'audit progressivement** : insérer un audit `status: 'started'` dès le début, puis le mettre à jour à la fin → permet de détecter immédiatement les futurs timeouts.
4. **Ajouter un timeout garde-fou** : envelopper chaque traitement de ligue dans un `Promise.race` avec timeout 30s pour qu'une ligue lente ne bloque pas les autres.

### Étape 3 — Renvoyer manuellement le récap hebdo de la semaine du 20 au 26 avril

Une fois le code corrigé et déployé, invoquer manuellement la fonction en LIVE :
```
POST /arena-recaps  body={"type":"weekly","date":"2026-04-26"}
```
pour publier rétroactivement le bilan hebdo manqué dans les 12 ligues actives.

### Étape 4 — Vérification

- Confirmer via `SELECT * FROM cron.job WHERE jobid IN (22,23)` que les nouveaux schedules sont actifs.
- Confirmer la présence d'une ligne `weekly` dans `arena_recap_runs` après l'exécution manuelle.
- Vérifier qu'un message "🏆 Bilan de la semaine" apparaît dans le canal #general des 12 ligues.

## Détails techniques

**Fichiers modifiés** :
- `supabase/functions/arena-recaps/index.ts` (parallélisation + audit progressif)
- 1 migration SQL `cron.alter_job` pour les jobids 22 et 23 (via outil insert, pas migration, conformément au standard projet sur les crons)

**Risques** :
- La parallélisation augmente la charge instantanée sur la DB ; les RPC `get_weekly_top_riders` et `get_daily_points_by_manager` doivent supporter ~12 appels concurrents (devrait être OK, requêtes courtes scope-ligue).
- L'envoi rétroactif du récap hebdo du 26/04 publiera un message daté du dimanche dans toutes les ligues. À valider avant exécution.
