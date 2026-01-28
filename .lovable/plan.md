

# Correction : Classement managers et porteurs de maillots sur le visuel d'export (Top 10 Managers)

## Diagnostic

Deux requetes echouent silencieusement a cause de jointures invalides :

### Bug 1 : Edge function `stage-jersey-bonuses`
La table `points_ledger` n'a pas de colonne `manager_id`, donc la jointure `managers!inner` echoue et retourne un tableau vide.

### Bug 2 : Query `managerRanking` dans ExportResultsImage.tsx
PostgREST rejette la requete car il n'y a pas de FK directe entre `points_ledger` et `rosters`.

---

## Solution

### Fichier 1 : `supabase/functions/stage-jersey-bonuses/index.ts`

Supprimer la jointure invalide et recuperer le manager via `rosters` puis `managers` separement.

### Fichier 2 : `src/components/admin/ExportResultsImage.tsx`

Remplacer la jointure invalide par deux requetes separees + aggregation JS :

```typescript
const { data: managerRanking, isLoading: loadingManagerRanking } = useQuery({
  queryKey: ["export-manager-ranking", course.course_id, etapeNumero, leagueId],
  queryFn: async () => {
    // 1. Recuperer tous les points de la course
    let pointsQuery = supabase
      .from('points_ledger')
      .select('coureur_id, points, etape_numero')
      .eq('course_id', course.course_id);
    
    if (etapeNumero) {
      pointsQuery = pointsQuery.lte('etape_numero', etapeNumero);
    }
    
    const { data: pointsData, error: pointsError } = await pointsQuery;
    if (pointsError) throw pointsError;
    
    // 2. Recuperer tous les rosters de la phase/league avec manager
    let rostersQuery = supabase
      .from('rosters')
      .select('coureur_id, manager_id, managers!inner(nom)')
      .eq('phase_id', course.phase_id);
    
    if (leagueId) {
      rostersQuery = rostersQuery.eq('league_id', leagueId);
    }
    
    const { data: rostersData, error: rostersError } = await rostersQuery;
    if (rostersError) throw rostersError;
    
    // 3. Creer une map coureur -> manager
    const coureurToManager = new Map();
    for (const r of rostersData || []) {
      if (r.coureur_id && r.manager_id) {
        coureurToManager.set(r.coureur_id, {
          managerId: r.manager_id,
          managerNom: r.managers?.nom || 'Inconnu'
        });
      }
    }
    
    // 4. Agreger les points par manager
    const managerTotals = new Map();
    for (const p of pointsData || []) {
      const mgr = coureurToManager.get(p.coureur_id);
      if (mgr) {
        const current = managerTotals.get(mgr.managerId) || { nom: mgr.managerNom, total: 0 };
        current.total += p.points;
        managerTotals.set(mgr.managerId, current);
      }
    }
    
    // 5. Trier et retourner top 10
    return Array.from(managerTotals.entries())
      .map(([id, { nom, total }]) => ({ manager_id: id, manager_nom: nom, total_points: total }))
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 10); // TOP 10 au lieu de 5
  },
  enabled: open && !!leagueId,
});
```

### Affichage compact du classement managers

Reduire la taille pour ne pas prendre trop de place :

```typescript
{/* CLASSEMENT MANAGERS - Compact */}
{managerRanking && managerRanking.length > 0 && (
  <div style={{
    marginTop: "30px",
    borderTop: "2px solid #FFD500",
    paddingTop: "20px",
  }}>
    <p style={{ fontSize: "18px", fontWeight: "600", marginBottom: "10px", color: "#1a1a1a" }}>
      Classement Managers
    </p>
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {managerRanking.map((m, idx) => (
        <div key={m.manager_id} style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: idx === 0 ? "#FEF3C7" : "#f9fafb",
          borderRadius: "4px",
          fontSize: "16px", // Plus petit
        }}>
          <span>
            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`} {m.manager_nom}
          </span>
          <span style={{ fontWeight: "bold" }}>{m.total_points} pts</span>
        </div>
      ))}
    </div>
  </div>
)}
```

---

## Comparaison tailles (Top 5 vs Top 10)

| Element | Top 5 (avant) | Top 10 (apres) |
|---------|---------------|----------------|
| Titre section | 20px | **18px** |
| Lignes managers | 20px | **16px** |
| Padding lignes | 10px 16px | **8px 12px** |
| Gap entre lignes | 8px | **6px** |
| Nombre affiche | 5 | **10** |

---

## Tests attendus

Apres correction, le visuel d'export devra afficher :
- **Points maillots** : `🟡 6pts 🟢 4pts`
- **Classement Managers** : Top 10 des managers en format compact

