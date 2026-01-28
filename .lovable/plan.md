

# Modifier le visuel d'export : classement managers et simplification

## Objectif

Trois modifications sur l'image d'export :
1. Afficher les points des maillots individuels (Leader +5, Points +5, etc.) de maniere discrete
2. Ajouter un classement des managers de la ligue avec leurs points sur la course
3. Supprimer la colonne "Equipe" du tableau et grossir le reste

---

## Modifications techniques

### Fichier : `src/components/admin/ExportResultsImage.tsx`

**1. Enrichir le mapping des jerseyHolders pour inclure les points** (ligne 158)

```typescript
return (data?.bonuses || []).map((jersey: any) => ({
  type_classement: `Porteur ${jersey.jersey_type.charAt(0).toUpperCase() + jersey.jersey_type.slice(1)}`,
  icon: jersey.icon,
  coureurs: { nom: jersey.coureur_nom },
  managers: { nom: jersey.manager_nom || null },
  points: jersey.points, // Ajouter le champ points
}));
```

**2. Nouvelle query pour le classement managers sur la course** (apres ligne 166)

```typescript
const { data: managerRanking, isLoading: loadingManagerRanking } = useQuery({
  queryKey: ["export-manager-ranking", course.course_id, etapeNumero, leagueId],
  queryFn: async () => {
    // Pour les courses a etapes : cumul jusqu'a l'etape courante
    // Pour One day : total de la course
    const { data, error } = await supabase
      .from('points_ledger')
      .select(`
        points,
        rosters!inner(manager_id, league_id, managers!inner(nom))
      `)
      .eq('course_id', course.course_id)
      .eq('rosters.phase_id', course.phase_id);
    
    if (error) throw error;
    
    // Filtrer par ligue si specifie
    let filtered = data || [];
    if (leagueId) {
      filtered = filtered.filter((r: any) => r.rosters.league_id === leagueId);
    }
    
    // Pour les courses a etapes, filtrer jusqu'a l'etape courante
    if (etapeNumero) {
      // Refaire la query avec le filtre etape
      const { data: dataFiltered } = await supabase
        .from('points_ledger')
        .select(`
          points,
          etape_numero,
          rosters!inner(manager_id, league_id, managers!inner(nom))
        `)
        .eq('course_id', course.course_id)
        .eq('rosters.phase_id', course.phase_id)
        .lte('etape_numero', etapeNumero);
      
      filtered = (dataFiltered || []).filter((r: any) => 
        !leagueId || r.rosters.league_id === leagueId
      );
    }
    
    // Agreger par manager
    const managerTotals = new Map<string, { nom: string; total: number }>();
    for (const row of filtered) {
      const roster = row.rosters as any;
      const managerId = roster.manager_id;
      const managerNom = roster.managers.nom;
      const current = managerTotals.get(managerId) || { nom: managerNom, total: 0 };
      current.total += row.points;
      managerTotals.set(managerId, current);
    }
    
    return Array.from(managerTotals.entries())
      .map(([id, { nom, total }]) => ({ manager_id: id, manager_nom: nom, total_points: total }))
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 5); // Top 5 managers
  },
  enabled: open && !!leagueId,
});
```

**3. Supprimer la colonne Equipe et grossir les autres** (lignes 463-501)

Avant (5 colonnes) :
```
#  | Coureur | Equipe | Manager | Pts
```

Apres (4 colonnes) :
```
#  | Coureur        | Manager | Pts
```

Nouvelles tailles :
| Element | Avant | Apres |
|---------|-------|-------|
| Position | 24px | **28px** |
| Coureur | 22px | **26px** |
| Manager | 20px | **24px** |
| Points | 22px | **26px** |
| Padding | 14px 16px | **16px 20px** |

**4. Modifier la section maillots pour afficher les points individuels** (lignes 509-546)

Remplacer les cartes par une ligne discrete :

```typescript
{/* POINTS MAILLOTS - Discret */}
{!isOneDay && jerseyHolders && jerseyHolders.length > 0 && (
  <div style={{
    display: "flex",
    justifyContent: "center",
    gap: "30px",
    fontSize: "18px",
    color: "#6b7280",
    marginTop: "20px",
  }}>
    {jerseyHolders.map((jersey: any, idx: number) => (
      <span key={idx}>
        {jersey.icon} {jersey.points} pts
      </span>
    ))}
  </div>
)}
```

**5. Ajouter le classement managers avant le footer** (avant ligne 549)

```typescript
{/* CLASSEMENT MANAGERS */}
{managerRanking && managerRanking.length > 0 && (
  <div style={{
    marginTop: "30px",
    borderTop: "2px solid #FFD500",
    paddingTop: "20px",
  }}>
    <p style={{ fontSize: "20px", fontWeight: "600", marginBottom: "12px", color: "#1a1a1a" }}>
      Classement Managers
    </p>
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {managerRanking.map((m, idx) => (
        <div key={m.manager_id} style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 16px",
          background: idx === 0 ? "#FEF3C7" : "#f9fafb",
          borderRadius: "6px",
          fontSize: "20px",
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

## Design final

```text
┌────────────────────────────┐
│       AlUla Tour           │
│   2.pro • General • Etape 5│
│      31 janvier 2026       │
├────────────────────────────┤ ← Ligne jaune
│                            │
│ #  │ Coureur       │ Mgr  │ Pts │
│ ─────────────────────────────── │
│ 🥇 │ MILAN         │ Bubu │ 150 │
│ 🥈 │ ACKERMANN     │ Fab  │ 120 │
│ 🥉 │ SKERL         │ Fab  │ 100 │
│  4 │ ...           │ ...  │  80 │
│ ...│ ...           │ ...  │ ... │
│                            │
│ 🟡 5pts  🟢 5pts  🔴 3pts  │  ← Discret, une ligne
│                            │
├────────────────────────────┤ ← Ligne jaune
│  Classement Managers       │
│ 🥇 Fab          │  520 pts │
│ 🥈 Bubu         │  480 pts │
│ 🥉 Alex         │  350 pts │
│  4. Jean        │  280 pts │
│  5. Marie       │  220 pts │
├────────────────────────────┤
│        MPC 2026            │
└────────────────────────────┘
```

---

## Recapitulatif des changements

| Section | Modification |
|---------|--------------|
| Tableau | Suppression colonne Equipe, polices +4px |
| Maillots | Ligne discrete avec icone + points |
| Managers | Nouveau bloc avec top 5 de la ligue |

