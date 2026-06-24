## Problème

Dans la ligue MPC 2026, le compte à rebours pour la P4 ne s'affiche pas, alors qu'on est à moins de 10 jours du début des enchères (01/07/2026 12:00 UTC).

## Cause

La date d'ouverture est bien enregistrée dans `phase_auction_schedule` (table admin "Planning enchères par phase"), mais elle n'a pas été propagée dans `auctions.opens_at` pour la ligue MPC 2026 / P4. La ligne d'enchère P4 round 1 a `opens_at = NULL`.

Le hook `useLeagueAuctionStatus` qui pilote l'affichage du compte à rebours (et qui respecte déjà la règle "10 jours avant") filtre `.not('opens_at','is',null)`, donc il ignore cette enchère et ne montre rien.

Une fonction SQL `sync_phase_schedule_to_auctions(phase_id)` existe déjà pour propager la date du planning vers les enchères des ligues actives par phase. Elle n'a simplement pas été rejouée depuis que la P4 a été planifiée.

## Correctif

Migration unique qui rejoue la synchro pour toutes les phases déjà planifiées :

```sql
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT phase_id FROM public.phase_auction_schedule LOOP
    PERFORM public.sync_phase_schedule_to_auctions(r.phase_id);
  END LOOP;
END $$;
```

Effet attendu sur MPC 2026 :
- `auctions` (P4, round 1, scheduled) → `opens_at = 2026-07-01 12:00 UTC`, `deadline_at = 2026-07-02 12:00 UTC`.
- Le hook `useLeagueAuctionStatus` voit l'enchère, calcule `diffDays ≈ 7` (≤ 10), et affiche la carte de compte à rebours sur le dashboard de la ligue.

Aucun changement de code frontend nécessaire : la règle "10 jours avant" (`SCHEDULED_VISIBILITY_DAYS = 10` dans `useLeagueAuctionStatus.tsx`) est déjà en place et fonctionne.

## Vérification

Après la migration, requête de contrôle :
```sql
SELECT id, statut, opens_at FROM auctions
WHERE phase_id = 'a4dc1df4-6386-48cb-93fd-77bdf99f4117'
  AND league_id = 'b5b46b5e-7c78-4ad9-a669-b08e8f099800';
```
doit retourner `opens_at = 2026-07-01 12:00:00+00`. Puis rafraîchir la page MPC 2026 → la carte "Les enchères vont démarrer" avec le compte à rebours doit apparaître.
