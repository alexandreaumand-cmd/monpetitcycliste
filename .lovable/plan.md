

## Corriger le classement manquant (MPC 2026)

### Cause racine
Deux bugs identifiés :

1. **Erreur SQL** : La fonction `get_previous_standings` déclare `total_points bigint` dans son type de retour, mais les `SUM()` internes retournent `numeric`. Cela provoque l'erreur `42804` visible dans la console, ce qui fait échouer silencieusement la requête d'évolution. Bien que ce ne soit pas directement la cause du tableau vide, cela pollue le rendu.

2. **Bug d'opérateur JS (cause principale)** : Ligne 371 de `ManagerStandings.tsx` :
   ```tsx
   {!standings || standings.length === 0 && (...)}
   ```
   `&&` a une priorité plus élevée que `||`, donc l'expression est évaluée comme :
   ```tsx
   {!standings || (standings.length === 0 && (...))}
   ```
   Quand `standings` est un tableau non vide, `!standings` est `false`, et `standings.length === 0 && (...)` est `false`, donc le message "aucun classement" n'apparaît PAS — mais le vrai problème est que quand `standings` est un tableau vide `[]`, `!standings` est `false` (car `[]` est truthy), et `standings.length === 0 && (...)` affiche le message correctement. Cependant quand `standings` est `undefined` (avant le chargement), `!standings` est `true` et le message vide s'affiche — ce qui bloque visuellement le contenu.

   **Attendez** — re-vérifions : `!undefined` = `true`, donc on voit le div vide, pas les données. Mais `isLoading` devrait couvrir ce cas... Sauf si le query est `enabled: !leagueLoading` et que `leagueLoading` est `false` avant que `selectedSeason` soit prêt → la query retourne `[]` (ligne 99), ce résultat est mis en cache, et quand `selectedSeason` arrive, le `staleTime: 5min` du QueryClient empêche un refetch.

### Corrections

**1. Migration SQL** — Corriger le type de retour de `get_previous_standings` :
- Caster `t.total_points::bigint` dans le `SELECT` final, ou changer le type de retour en `numeric`

**2. `ManagerStandings.tsx`** — Deux corrections :
- Ligne 371 : Corriger la condition avec des parenthèses :
  ```tsx
  {(!standings || standings.length === 0) && (...)}
  ```
- Ligne 101 : Ajouter `selectedSeason` ou `phaseId` dans la condition `enabled` pour éviter qu'une requête vide ne soit mise en cache :
  ```tsx
  enabled: !leagueLoading && !!leagueId && (!!phaseId || !!selectedSeason),
  ```

### Résultat attendu
- Le classement MPC 2026 s'affiche correctement
- L'erreur console `42804` disparaît
- Les ligues "à la course" ne sont pas impactées

