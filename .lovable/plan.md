

## Filtrer les mouvements startlists par courses de la ligue

### Problème
Le composant `StartlistTrackerMovements` charge **toutes les courses de la phase** pour afficher les mouvements. Pour une ligue "à la course" comme "Flandriennes 2026", cela inclut des courses non sélectionnées (Volta a Catalunya, Settimana Coppi, Paris-Camembert, etc.).

### Solution
Filtrer la liste des courses affichées par les `selected_course_ids` de la ligue quand le mode est "à la course".

### Fichier à modifier

**`src/components/startlist/StartlistTrackerMovements.tsx`**

1. Ajouter une requête pour récupérer le `league_scopes` de la ligue courante (champ `selected_course_ids`)
2. Dans le query `phase-courses-for-movements`, si `selected_course_ids` est non vide, filtrer les courses avec `.in("id", selectedCourseIds)` au lieu de charger toute la phase
3. Conserver le comportement actuel (toutes les courses de la phase) pour les ligues sans `selected_course_ids`

### Logique clé
```tsx
// Fetch league scope
const { data: leagueScope } = useQuery({
  queryKey: ["league-scope-courses", leagueId],
  queryFn: async () => {
    const { data } = await supabase
      .from("league_scopes")
      .select("selected_course_ids")
      .eq("league_id", leagueId)
      .single();
    return data?.selected_course_ids || [];
  },
  enabled: !!leagueId,
});

// In phase courses query, apply filter:
let query = supabase.from("courses").select("id, date_debut");
if (leagueScope?.length) {
  query = query.in("id", leagueScope);
} else {
  query = query.eq("phase_id", phaseId);
}
query = query.gte("date_fin", today).order("date_debut", { ascending: true });
```

### Résultat attendu
- Ligue "Flandriennes 2026" : seuls les mouvements des 5 courses sélectionnées apparaissent
- Ligues "5 Phases" : comportement inchangé (toutes les courses de la phase)

