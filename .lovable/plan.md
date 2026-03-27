

## Fix comparaison managers : utiliser les vues standings officielles

### Problème
Le composant `ManagerComparison` recalcule manuellement les totaux (points, scoreurs) à partir de requêtes brutes sur `points_ledger`, `bonus_points` et `manager_bonus_points`. Ces calculs sont incorrects (Ludo affiche 63 pts au lieu de 880, Alex 0 scoreurs au lieu de 1). La vue matérialisée `v_manager_standings_by_season_v2` contient les bonnes valeurs.

### Cause
Multiples sources d'erreur dans le calcul manuel :
- Requêtes potentiellement tronquées (limite 1000 rows)
- Scoping incorrect des points par ligue/saison pour les ligues `per_course`
- Comptage scoreurs par `coureur_id|phase_id` au lieu de `coureur_id` seul

### Solution
Remplacer les 4 KPI cards (Total Points, Scoreurs, ROI, Victoires) par des données issues directement de la vue standings officielle, qui est déjà pré-calculée et correcte.

#### Modification — `src/components/rankings/ManagerComparison.tsx`

1. **Ajouter une requête standings** pour les deux managers en une seule requête :
```typescript
const { data: standingsData } = useQuery({
  queryKey: ["standings-comparison", managerA, managerB, phaseId, saisonId, leagueId],
  queryFn: async () => {
    const ids = [managerA, managerB].filter(Boolean) as string[];
    if (phaseId) {
      const { data } = await supabase
        .from("v_manager_standings_by_phase_v2")
        .select("manager_id, total_points, nb_scoreurs, nb_victoires")
        .eq("league_id", leagueId!)
        .eq("phase_id", phaseId)
        .in("manager_id", ids);
      return data;
    } else if (saisonId) {
      const { data } = await supabase
        .from("v_manager_standings_by_season_v2")
        .select("manager_id, total_points, nb_scoreurs, nb_victoires")
        .eq("league_id", leagueId!)
        .eq("saison_id", saisonId)
        .in("manager_id", ids);
      return data;
    }
    return [];
  },
  enabled: !!(managerA || managerB) && !!leagueId,
});
```

2. **Remplacer les calculs manuels** (lignes 685-711) par des lookups dans `standingsData` :
```typescript
const standA = standingsData?.find(s => s.manager_id === managerA);
const standB = standingsData?.find(s => s.manager_id === managerB);
const totalPointsA = Math.round(standA?.total_points || 0);
const totalPointsB = Math.round(standB?.total_points || 0);
const scoreursA = standA?.nb_scoreurs || 0;
const scoreursB = standB?.nb_scoreurs || 0;
const victoiresA = standA?.nb_victoires || 0;
const victoiresB = standB?.nb_victoires || 0;
```

3. **Supprimer les requêtes devenues inutiles** pour les KPIs : `bonusPointsA/B`, `managerBonusA/B`, `victoriesCountA/B` (les requêtes `pointsA/B` restent nécessaires pour les tableaux de répartition par catégorie et les radars).

4. **Appliquer le même fix** dans `ManagerComparison.mobile.tsx`.

### Fichiers impactés
- `src/components/rankings/ManagerComparison.tsx` — standings query + suppression calculs manuels
- `src/components/rankings/ManagerComparison.mobile.tsx` — même logique

