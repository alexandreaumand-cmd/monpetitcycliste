## Objectif

Faire baisser immédiatement la pression sur l'instance Tiny **sans upgrader**, le temps que le pic Phase 3 retombe (quelques heures à 1-2 jours). Si la charge ne redescend pas durablement, l'upgrade Small restera la seule vraie solution.

## Diagnostic à l'instant T

- **Aucune requête utilisateur longue en cours** (`pg_stat_activity` = clean). Pas besoin de `pg_terminate_backend()` maintenant. Je fournis quand même le snippet SQL en annexe pour pouvoir tuer un futur burst à la main.
- **7 crons actifs** sur l'instance Live, dont 3 fréquents (toutes les 5 min) + 1 toutes les 5 secondes (`process-email-queue`).
- La saturation arrive **par vagues** : un burst d'utilisateurs + un cron qui tombe au même moment = timeouts en cascade.

## Plan d'action (2 leviers, effet immédiat)

### Levier 1 — Espacer les crons non-critiques (côté DB)

Modifier les schedules pendant 24-48h. Aucune perte fonctionnelle, juste un délai un peu plus long.

| Cron | Schedule actuel | Nouveau schedule | Impact |
|---|---|---|---|
| `arena-pronostic-reminder` (id 15) | toutes les 5 min | toutes les **15 min** | Rappels pronos arrivent un peu plus tard |
| `auto-open-scheduled-auctions` (id 19) | toutes les 5 min | toutes les **10 min** | Ouverture enchères jusqu'à +5 min de retard |
| `auto-close-ghost-auctions` (id 2) | toutes les 5 min | toutes les **15 min** | Nettoyage ghost auctions plus lent |
| `startlist-tracker-sync` (id 14) | toutes les 5 min (5h-21h) | toutes les **15 min** | Maj startlists 3x/h au lieu de 12x/h |
| `process-email-queue` (id 33) | toutes les **5 sec** | toutes les **30 sec** | Emails partent avec ~30s de délai |

→ Réduit la fréquence cron de **~75%** sans rien casser fonctionnellement.

À ne **pas** toucher : recap arena (id 31, 32) — déjà 1x/jour.

### Levier 2 — Augmenter le cache React Query côté front

Sur les hooks qui appellent les RPC les plus lourdes (classements, leaderboards) :

- `useLeagueStandings`, `useLeagueRankings`, `useGlobalStandings`, `usePrestigeStandings`, `useLeagueCardsData`, `useMyLeagueStats`
- Passer `staleTime` de 5 min → **15 min**
- Passer `refetchOnWindowFocus` à `false` (évite les re-fetch quand l'utilisateur revient sur l'onglet)
- Passer `refetchOnMount` à `false` quand un cache existe déjà

→ Diviserait par ~3 le nombre de RPC `get_league_standings_*` par utilisateur actif.

### Ce que je NE ferai PAS

- ❌ Toucher aux mutations critiques (place_bid, validation enchères, auth)
- ❌ Désactiver le scraping PCS le soir (id 14 reste actif, juste moins fréquent)
- ❌ Modifier les RPC elles-mêmes (sujet d'optimisation à part, plus risqué)

## Annexe technique : tuer un burst en cours (à garder sous le coude)

Si un nouveau pic arrive et que tu vois des timeouts, lance ça depuis Cloud → SQL :

```sql
-- 1. Voir ce qui tourne
SELECT pid, now() - query_start AS duration, state, left(query, 100)
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds'
  AND pid <> pg_backend_pid();

-- 2. Tuer les requêtes qui dépassent 8s (au cas par cas)
SELECT pg_cancel_backend(pid)  -- pg_terminate_backend si cancel ne marche pas
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '8 seconds'
  AND query NOT ILIKE '%replication%' AND query NOT ILIKE '%pg_stat%';
```

## Réversibilité

Quand le pic est passé (ou après upgrade), on remet les schedules d'origine en 1 migration et on rebaisse les `staleTime`. Tout est trivialement réversible.

## Étapes d'implémentation

1. Migration SQL : `cron.unschedule` + `cron.schedule` pour les 5 crons listés
2. Édition des 6 hooks React Query → `staleTime: 15 * 60 * 1000`
3. Vérifier dans les logs edge functions que les crons tournent bien à la nouvelle cadence
4. Surveiller `pg_stat_activity` 30 min après pour confirmer la baisse de charge

**Effet attendu** : -40 à -60% de charge DB en heure de pointe. Suffisant pour tenir la Phase 3 sans upgrade. Si insuffisant après 2h, on bascule sur l'upgrade Small.
