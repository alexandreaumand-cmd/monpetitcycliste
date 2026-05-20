# Fix: étape 11 du Giro absente du récap quotidien

## Constat

Le récap MPC2026 du 20 mai n'inclut aucun point pour l'étape 11 du Giro alors qu'elle s'est courue aujourd'hui et que les résultats ont bien été scrapés (mise à jour en base à 15:11 UTC).

## Cause

Le récap quotidien filtre les classements via `race_results.date_classement` entre 00:00 et 23:59 du jour. Or, les résultats de l'étape 11 ont été insérés avec `date_classement = 2026-05-18`, pas `2026-05-20`.

La date provient de la fonction PostgreSQL `admin_result_save_lot` (appelée par le scraper). Elle calcule la date ainsi :

```
date_debut_course + (etape_numero - 1)
```

Pour le Giro : `2026-05-08 + 10 jours = 2026-05-18`. Ce calcul linéaire ignore les jours de repos du Giro 2026 (11 mai et 25 mai), donc toutes les étapes après le premier jour de repos sont décalées.

La table `course_stage_config` contient pourtant la vraie date de chaque étape (étape 11 = 2026-05-20), et la fonction `admin-stage-save-step` (saisie manuelle) la respecte déjà. Seule la voie automatique l'ignore.

## Correctif

1. **Modifier la fonction SQL `admin_result_save_lot`** pour qu'elle lise d'abord `course_stage_config.stage_date` quand `p_etape_numero` est fourni, et ne retombe sur le calcul linéaire qu'en l'absence de configuration.

   Nouvelle logique :
   ```text
   v_auto_date :=
     COALESCE(
       (SELECT stage_date FROM course_stage_config
        WHERE course_id = p_course_id AND etape_numero = p_etape_numero),
       date_debut + (etape - 1) jours,         -- fallback étape
       date_fin, date_debut, CURRENT_DATE      -- fallback non-étape
     )
   ```

2. **Backfill des résultats existants mal datés** : pour chaque ligne de `race_results` où une `course_stage_config.stage_date` existe et diffère, mettre à jour `date_classement`. Cela corrige immédiatement l'étape 11 + toutes les étapes 4-10 du Giro déjà décalées d'un jour.

3. **Re-déclencher le récap du jour** pour MPC2026 (via `arena-recaps` avec `type: "daily"`, `date: "2026-05-20"`) une fois le backfill terminé, pour que le canal #general reçoive enfin les bons points.

## Détails techniques

- Migration SQL : `CREATE OR REPLACE FUNCTION public.admin_result_save_lot(...)` avec la nouvelle résolution de date.
- Backfill SQL :
  ```sql
  UPDATE race_results rr
  SET date_classement = csc.stage_date
  FROM course_stage_config csc
  WHERE rr.course_id = csc.course_id
    AND rr.etape_numero = csc.etape_numero
    AND csc.stage_date IS NOT NULL
    AND rr.date_classement <> csc.stage_date;
  ```
- Aucun changement frontend nécessaire.
- Aucun impact sur les points déjà calculés (`points_ledger`) : seuls les filtres par date du récap sont affectés.

## Hors scope

- Les jours de repos manquants côté `course_stage_config` (étape 16 → 26/05 confirmé en base, OK).
- L'auto-scrape lui-même : il continuera de fonctionner, simplement avec une date correcte.
