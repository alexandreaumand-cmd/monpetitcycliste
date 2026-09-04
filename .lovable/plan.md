# Recalcul ciblé des bonus coureur (course, étape, coureur)

## Ce que je propose

Bonne idée : aujourd'hui le recalcul est « tout ou rien » sur la phase entière — il supprime puis régénère l'ensemble des bonus « Coureur Bonusé » de la phase, ce qui est long et risqué si une seule course pose problème.

Je propose de garder le même bouton, mais d'ajouter un périmètre optionnel avant de lancer :

- **Course** (optionnel) : ne recalcule que les bonus liés à cette course.
- **Étape** (optionnel, visible seulement si la course est une course à étapes) : ne recalcule que les lignes de cette étape, plus la possibilité de viser les classements finaux.
- **Coureur** (optionnel) : ne recalcule que ce coureur.

Par défaut, aucun filtre = comportement actuel (toute la phase), donc rien ne casse.

Le récapitulatif avant validation indiquera précisément ce qui va être supprimé et régénéré (« 1 course, étape 4, 1 coureur — 3 bonus concernés »), et le message de fin donnera l'avant/après en points.

## Comportement de suppression

Point important : la suppression doit être aussi ciblée que le recalcul. Si on filtre sur une course/étape/coureur, seuls les bonus de ce périmètre sont supprimés — les autres bonus de la phase restent intacts. C'est ce qui rend l'opération sûre.

## Détails techniques

- **Edge Function `recalculate-rider-bonuses`** : accepter en plus de `phase_id` les paramètres optionnels `course_id`, `etape_numero` (avec un mode « classements finaux » = `etape_numero: null`) et `coureur_id` (déjà supporté).
  - Filtrer la requête `bonus_rider_selections` par `coureur_id` si fourni.
  - Restreindre la suppression des bonus existants au périmètre : ajouter `course_id`, et filtrer sur `etape_numero` / `type_classement` selon les colonnes de granularité déjà présentes sur `bonus_points` (`etape_numero`, `type_classement`).
  - Restreindre la lecture de `points_ledger` au même périmètre avant de recalculer les 25 %.
  - Conserver le contrôle superadmin, le scope de ligue (`get_league_course_ids`), le refresh des vues de classement et l'audit, en journalisant le périmètre utilisé.
- **UI `src/components/admin/bonus/RiderBonusTab.tsx`** : dans la boîte de dialogue de recalcul, ajouter trois sélecteurs (course via un combobox recherchable comme celui déjà utilisé pour la saisie, étape via la config d'étapes de la course, coureur via la recherche existante), tous avec une option « Toutes / Tous ». Passer les valeurs choisies au `functions.invoke`.
- Le bloc d'aide au-dessus du bouton est reformulé pour expliquer le périmètre.

## Validation

- Recalcul sans filtre : totaux identiques à aujourd'hui.
- Recalcul sur une seule course : seuls les bonus de cette course changent, les autres courses de la phase gardent leurs points.
- Recalcul sur une étape précise : un seul bonus régénéré, égal à 25 % des points de ce classement.
- Recalcul sur un coureur : bonus des autres coureurs inchangés.
