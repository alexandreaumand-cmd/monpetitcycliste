# Fix saisie des résultats (PGRST203)

## Problème

Depuis le fix d'hier sur les dates d'étapes du Giro, la saisie de résultats échoue avec :

> Edge Function returned a non-2xx status code

Les logs de `admin-result-save-lot` montrent une erreur PostgREST `PGRST203` : deux versions surchargées de la fonction `admin_result_save_lot` cohabitent en base (l'ancienne avec `p_type_classement type_classement`, la nouvelle avec `p_type_classement text`), et PostgREST n'arrive pas à choisir.

## Correction

Migration SQL qui supprime l'ancienne signature pour ne laisser que la nouvelle (celle qui gère les dates via `course_stage_config`) :

```sql
DROP FUNCTION IF EXISTS public.admin_result_save_lot(
  text, public.type_classement, integer, jsonb
);
```

La version `text` reste en place et continue de fonctionner pour la saisie manuelle comme pour le scrape auto.

## Vérification

- Re-tester la saisie de l'étape 2 des 4 Jours de Dunkerque (cas reproduit dans la capture).
- Vérifier dans les logs edge function que `admin-result-save-lot` retourne 200.
