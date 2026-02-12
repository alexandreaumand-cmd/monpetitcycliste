
# Corriger le coureur_id manquant dans les logs de retrait

## Probleme

Quand le startlist tracker enregistre un **retrait** de coureur dans `startlist_tracker_changes`, il n'inclut pas le `coureur_id`. Le champ reste `NULL`.

Or, la page "Mouvements startlists" filtre avec `.in("coureur_id", rosterCoureurIds)`, ce qui exclut toutes les lignes ou `coureur_id` est `NULL`. Les retraits sont donc invisibles.

Les **ajouts** fonctionnent correctement car le `coureur_id` est renseigne via le matching (ligne 843).

## Cause racine

Dans `supabase/functions/startlist-tracker/index.ts` :

1. **Ligne 634** : le type `toRemoveEntryIds` est `{ id: string; source_name: string }[]` -- il ne porte pas `coureur_id`
2. **Ligne 654** : l'insertion dans `toRemoveEntryIds` omet `coureur_id`, alors que `existingSigMap` le contient deja
3. **Ligne 770-781** : l'insert dans `startlist_tracker_changes` pour les retraits n'inclut pas `coureur_id`

## Correction (3 points dans le meme fichier)

Fichier : `supabase/functions/startlist-tracker/index.ts`

1. **Ajouter `coureur_id` au type de `toRemoveEntryIds`** (ligne 634)
   - De : `{ id: string; source_name: string }[]`
   - A : `{ id: string; source_name: string; coureur_id: string | null }[]`

2. **Passer `coureur_id` lors du push** (ligne 654)
   - De : `toRemoveEntryIds.push({ id: entry.id, source_name: entry.source_name })`
   - A : `toRemoveEntryIds.push({ id: entry.id, source_name: entry.source_name, coureur_id: entry.coureur_id })`

3. **Inclure `coureur_id` dans l'insert du log de retrait** (ligne 770-781)
   - Ajouter `coureur_id: entry.coureur_id,` dans l'objet insere dans `startlist_tracker_changes`

## Impact

- Aucun changement de schema (la colonne `coureur_id` existe deja dans `startlist_tracker_changes`)
- Les futurs retraits auront le `coureur_id` renseigne et seront visibles dans les mouvements d'equipe
- Les retraits passes (deja en base avec `coureur_id = NULL`) ne seront pas corriges automatiquement, mais les prochains le seront
