## Problème

Dans la ligue **COPArdennaises**, l'écran "Détail des points" de Paul Seixas affiche 3 bonus `first_win` (Algarve Stage 2) qui ne devraient pas apparaître.

## Diagnostic confirmé

Données en LIVE pour Seixas :
- 3 bonus `first_win` existent, attribués à **MPC 2026** (1) et **Early Adopters** (2).
- **Aucun bonus first_win n'est attribué à COPArdennaises** (ce qui est correct, Algarve n'est pas dans son scope).
- Pourtant l'écran les affiche dans COPArdennaises → fuite côté edge function.

## Cause

Dans `supabase/functions/get-rider-points-table/index.ts`, la requête sur `bonus_points` ne filtre **pas par `league_id`**. Le filtre par scope de courses `course_id.is.null,course_id.in.(...)` laisse passer tous les bonus avec `course_id IS NULL`, peu importe à quelle ligue ils appartiennent. Or les bonus `first_win` sont stockés avec `course_id = NULL`.

## Pourquoi ne pas modifier le bonus pour lui affecter une course

Le modèle actuel est correct et volontaire :
- Un bonus `first_win` est attribué **par ligue éligible** : une ligne distincte est créée pour chaque `league_id` concerné.
- La propagation est gérée à la création du bonus, pas à la lecture.
- Le bonus n'est pas lié à une course du scope de la ligue — c'est un bonus "méta" sur la 1ère victoire de la saison du coureur.
- Affecter `course_id` = la course de la victoire (ex: Algarve) bloquerait l'affichage dans les ligues qui n'ont pas Algarve dans leur scope mais sont quand même éligibles au bonus.

→ Il suffit donc de filtrer correctement à la lecture par `league_id`.

## Correction

Dans `supabase/functions/get-rider-points-table/index.ts`, ajouter un filtre strict sur `league_id` pour la requête `bonusQuery` :

```ts
// Filtre principal : isolation par ligue
if (league_id) {
  bonusQuery = bonusQuery.eq('league_id', league_id);
}

// Filtre secondaire (sécurité) : si bonus lié à une course, elle doit être dans le scope
if (leagueCourseIds) {
  bonusQuery = bonusQuery.or(
    `course_id.is.null,course_id.in.(${leagueCourseIds.map(id => `"${id}"`).join(',')})`
  );
}
```

## Fichier modifié

- `supabase/functions/get-rider-points-table/index.ts`

## Impact attendu après publication LIVE

- COPArdennaises : Seixas n'affichera plus les bonus first_win d'Algarve (qui n'appartiennent pas à cette ligue).
- MPC 2026 et Early Adopters : continueront d'afficher leurs bonus first_win normalement.
- Aucune donnée n'est modifiée — uniquement la lecture est corrigée.

## Bonus : doublon détecté

J'ai aussi remarqué qu'**Early Adopters a 2 bonus first_win identiques** pour Seixas (100 pts au total au lieu de 50). Veux-tu que je supprime le doublon dans une étape séparée ? (Hors scope de cette correction.)
