# Sélecteur d'étape dans l'onglet "Managers"

## Objectif

Dans le drawer de résultats d'une course à étapes (ex. Tour de France), permettre à l'utilisateur de filtrer le classement des managers par étape, tout en conservant l'option « Total course » (toutes étapes et tous classements confondus, comportement actuel).

## UX

Dans l'onglet **Managers** du `CourseResultsDrawer`, ajouter au-dessus du tableau, uniquement pour les courses à étapes (`meta.etapes_disponibles.length > 0`), un `Select` :

- **Total course** (valeur par défaut) — affiche le classement agrégé sur toute la course (comportement actuel, tous types de classement + toutes étapes).
- **Étape 1**, **Étape 2**, … — affiche les points inscrits par chaque manager sur cette étape uniquement, tous classements confondus pour cette étape (classement d'étape + points marqués par les porteurs de maillots ce jour-là + éventuel classement général intermédiaire à la fin de l'étape).

Le sous-tableau développable « Coureurs contributeurs » reste, mais reflète le filtre courant (uniquement les points de l'étape sélectionnée le cas échéant).

Pour les courses d'un jour, aucun sélecteur n'est ajouté (comportement inchangé).

## Détails techniques

### 1. Edge function `supabase/functions/course-leaderboard/index.ts`

Aujourd'hui, `etape_numero` n'est pris en compte que si `type_classement === 'Etape'`. À modifier pour supporter un filtrage par étape seul (tous classements) :

```ts
if (type_classement) {
  pointsQuery = pointsQuery.eq('type_classement', type_classement);
}
if (etape_numero) {
  pointsQuery = pointsQuery.eq('etape_numero', etape_numero);
}
```

Ainsi :
- `type_classement=null, etape_numero=null` → total course (inchangé).
- `type_classement=null, etape_numero=N` → tous les points inscrits sur l'étape N.

### 2. Frontend `src/components/courses/CourseResultsDrawer.tsx`

- Ajouter un état local `leaderboardEtape: number | null` (défaut `null` = total).
- Injecter `leaderboardEtape` dans la `queryKey` et dans le `body` (`etape_numero: leaderboardEtape`) de la query `course-leaderboard-drawer`.
- Réinitialiser `leaderboardEtape` à `null` à chaque ouverture / changement de course.
- Rendre le `Select` en tête du `TabsContent value="leaderboard"` uniquement si `meta?.etapes_disponibles?.length > 0`, avec options `Total course` + une entrée par étape disponible.
- Le rendu du tableau et des contributeurs reste identique (les données renvoyées par l'edge function sont déjà filtrées).

## Vérification

1. Course d'un jour (ex. Milano-Sanremo) : onglet Managers inchangé, pas de sélecteur.
2. Course à étapes (Tour de France) :
   - Sélecteur visible, « Total course » sélectionné par défaut, totaux identiques à aujourd'hui.
   - Sélectionner « Étape 3 » recharge le tableau avec uniquement les points de l'étape 3 ; la somme des points d'un manager correspond aux points de ses coureurs sur cette étape (visibles dans l'onglet Étapes).
   - Le breakdown développable ne liste que les entrées de l'étape sélectionnée.
