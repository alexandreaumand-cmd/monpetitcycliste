## Diagnostic

Le récap du jeudi 14 mai n'inclut pas l'étape 6 du Giro car la fonction RPC `get_daily_points_by_manager` filtre sur `race_results.date_classement` (la date officielle de l'étape), et non sur la date d'ingestion des points.

Données vérifiées :
- Étape 6 du Giro → `date_classement = 2026-05-13` (date réelle de la course = mercredi)
- Mais les résultats ont été insérés en base le **2026-05-14 à 15:54 UTC** (jeudi, avant le récap de 20:30)
- Idem pour les étapes 4 et 5 (insérées vers 19:57-19:58 UTC, après l'envoi du récap → seront ratées définitivement)

Conséquence : un résultat ingéré en retard n'apparaît jamais dans aucun récap journalier (ni le jour réel de la course parce qu'il n'était pas encore en base, ni le jour de l'ingestion parce que `date_classement` est dans le passé).

## Correctif

Modifier la fonction SQL `public.get_daily_points_by_manager(p_league_id, p_start, p_end)` pour filtrer sur `points_ledger.created_at` (la date à laquelle les points sont entrés dans le système) au lieu de `race_results.date_classement`.

```sql
-- Remplacer
WHERE rr.date_classement >= p_start::date
  AND rr.date_classement <= p_end::date
-- Par
WHERE pl.created_at >= p_start
  AND pl.created_at <= p_end
```

Effets :
- Le récap du 14 mai inclura tous les points crédités le 14 mai, y compris ceux d'étapes courues les jours précédents mais ingérées aujourd'hui (étape 6 du Giro).
- Aucun changement nécessaire côté Edge Function `arena-recaps` ni côté UI.
- Le filtre `bonus_points` utilise déjà `created_at`, donc cohérent.

## Livrable

Une migration SQL `CREATE OR REPLACE FUNCTION public.get_daily_points_by_manager(...)` avec le seul changement du WHERE.