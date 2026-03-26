

## Fix "Nombre de victoires" — filtrage par ligue

### Problème
`fetchVictories` récupère TOUTES les victoires globales (`race_results` position=1) puis tente de filtrer via `courses.phase_id` en embed Supabase, ce qui ne fonctionne pas de façon fiable. Résultat : des victoires d'autres ligues apparaissent (3 et 9 au lieu de 0).

### Solution — `src/components/rankings/ManagerComparison.tsx`

Réécrire `fetchVictories` avec une approche en 3 étapes explicites :

1. **Récupérer les `courseIds`** de la ligue : `courses.id` filtrés par `phase_id IN phaseIds`
2. **Récupérer les `coureurIds`** du manager : depuis `rosters` filtrés par `league_id` + `manager_id`
3. **Requêter `race_results`** avec `.in("course_id", courseIds)` et `.in("coureur_id", coureurIds)` — filtrage direct, pas d'embed

Ajouter `leagueId` au `queryKey` des deux requêtes et `enabled: !!managerA && !!leagueId`.

### Même fix sur `ManagerComparison.mobile.tsx`
Appliquer la même logique à `fetchVictories` dans la version mobile.

### Fichiers impactés
- `src/components/rankings/ManagerComparison.tsx`
- `src/components/rankings/ManagerComparison.mobile.tsx`

