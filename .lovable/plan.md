## Diagnostic

En LIVE, **18 enchères** sont actuellement bloquées en statut `scheduled` alors que leur `opens_at` est passé (dont MPC 2026 et Early Adopters pour la Phase 3, ouverture prévue le 2026-05-05 12:00:00+00, il est 12:53).

### Ce que j'ai vérifié

- **Cron `auto-open-scheduled-auctions`** : actif, tourne toutes les 5 min, dernier run `succeeded` à 12:50.
- **MPC 2026 et Early Adopters** : statut `active`, enchère Phase 3 round 1 en `scheduled`, `opens_at` passé.
- **Appel direct de l'edge function** : retourne `{"message": "No active leagues with pending auctions", "opened": 0}`.

### Cause racine

L'edge function `auto-open-scheduled-auctions/index.ts` :
1. Récupère bien les enchères `scheduled` dont `opens_at` est passé.
2. Charge les ligues correspondantes et filtre celles avec `status === 'active'`.
3. Tombe dans la branche "No active leagues with pending auctions" → donc l'étape 2 retourne 0 ligue active alors que ce n'est pas le cas.

L'hypothèse la plus probable : la requête `supabase.from('leagues').select(...).in('id', leagueIds)` échoue silencieusement (erreur ignorée, pas de `.error` checké à la ligne 45), ce qui rend `activeLeagueIds` vide. Aucun log n'est émis (pas de logs trouvés pour cette fonction → les `console.log` ne sortent pas, signe possible d'un crash silencieux après l'appel `.in()`). À confirmer en exécution.

## Plan d'action

### 1. Débloquer immédiatement les 18 enchères en attente (LIVE)

Migration SQL one-shot pour passer en `open` les enchères `scheduled` dont `opens_at <= now()` ET dont la ligue est `active`, en recalculant `deadline_at` à +24h si dépassé. Ce sera appliqué sur Test puis publié vers LIVE par l'utilisateur.

```sql
UPDATE auctions a
SET statut = 'open',
    deadline_at = CASE
      WHEN a.deadline_at > now() THEN a.deadline_at
      ELSE now() + interval '24 hours'
    END
FROM leagues l
WHERE a.league_id = l.id
  AND a.statut = 'scheduled'
  AND a.opens_at <= now()
  AND l.status = 'active';
```

### 2. Corriger et durcir l'edge function `auto-open-scheduled-auctions`

- Vérifier explicitement l'erreur de la requête `leagues` (actuellement non checkée → ligne 45-48).
- Logger systématiquement le nombre d'auctions trouvées, la liste des `leagueIds`, le résultat de la requête `leagues`, et la composition de `activeLeagueIds` pour diagnostic durable.
- Wrapper l'appel notification dans un try/catch (déjà fait) mais aussi protéger l'update auction.
- S'assurer que les logs apparaissent (parfois absent si la fonction crashe sur l'import `notifyLeagueMembers`). Vérifier l'import et le rendre tolérant.

### 3. Notifier les managers des enchères ouvertes en rattrapage

Après le UPDATE one-shot, l'edge function ne renverra pas les notifications (puisqu'elle n'est pas passée par là). Deux options :
- **A.** Faire l'unblock via un appel à l'edge function corrigée (qui notifiera).
- **B.** Faire l'UPDATE en SQL puis envoyer manuellement les notifications via une RPC/fonction dédiée pour les ligues impactées.

Recommandation : **option A** — déployer la correction de l'edge function d'abord, puis l'invoquer (ou laisser le cron tourner 5 min plus tard). Plus simple, plus sûr, et les notifications partent normalement.

### 4. Vérification post-correction

- Re-query : plus aucune enchère `scheduled` avec `opens_at <= now()` et ligue `active`.
- Logs de l'edge function visibles dans les outils LIVE.
- Vérifier sur la page admin des cron jobs (créée dans une itération précédente) que `auto-open-scheduled-auctions` apparaît bien avec sa dernière exécution réussie.

## Détails techniques

- Fichier modifié : `supabase/functions/auto-open-scheduled-auctions/index.ts`
- Migration créée : un fichier `supabase/migrations/<timestamp>_unblock_scheduled_auctions.sql`
- Aucun changement frontend nécessaire.
- Aucun changement de schéma DB.

## Ce qui reste à confirmer après correction

Pourquoi la requête `leagues` retourne vide : à confirmer avec les logs après déploiement de la version instrumentée. Si le problème persiste, on creusera (timeout, RLS service-role, schéma du client). Mais le UPDATE SQL résout immédiatement le blocage utilisateur.
