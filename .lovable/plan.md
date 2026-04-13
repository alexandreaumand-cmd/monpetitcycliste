

# Fix : "object is not iterable" dans admin-leagues-list

## Cause
L'edge function `admin-leagues-list` sélectionne `league_members` deux fois dans la même requête (une fois pour `count`, une fois pour `user_id`). Selon la configuration Supabase, les résultats imbriqués peuvent revenir comme un objet au lieu d'un tableau, ce qui casse les boucles `for...of`.

## Correction : `supabase/functions/admin-leagues-list/index.ts`

Ajouter des gardes `Array.isArray()` avant chaque itération sur `member_users`, `scopes`, et les sous-champs :

```typescript
// Ligne 80-91 : remplacer les for...of par des versions défensives
const memberUsers = Array.isArray(league.member_users) ? league.member_users : [];
for (const m of memberUsers) { ... }

const scopes = Array.isArray(league.scopes) ? league.scopes : [];
for (const s of scopes) {
  const courseIds = Array.isArray(s.selected_course_ids) ? s.selected_course_ids : [];
  for (const id of courseIds) { ... }
}
```

Même traitement dans le bloc `transformedLeagues` (lignes 117-135) :
```typescript
const memberUserIds = Array.isArray(league.member_users)
  ? league.member_users.map((m: any) => m.user_id)
  : [];

const scopesList = Array.isArray(league.scopes) ? league.scopes : [];
for (const s of scopesList) {
  const ids = Array.isArray(s.selected_course_ids) ? s.selected_course_ids : [];
  scopeCourseIds.push(...ids);
}
```

## Fichier modifié
1. `supabase/functions/admin-leagues-list/index.ts` — ajout de gardes défensives `Array.isArray()` sur toutes les itérations de données imbriquées

