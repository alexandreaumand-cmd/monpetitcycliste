

# Simplifier l'image de partage

## Modifications demandees

1. **Supprimer la section "Podium Managers"** (lignes 560-598)
2. **Supprimer la query `managerPoints`** (lignes 120-165) - plus necessaire
3. **Modifier le footer** pour afficher uniquement le nom de la ligue

---

## Modifications techniques

### Fichier : `src/components/admin/ExportResultsImage.tsx`

**1. Ajouter une prop `leagueName` au composant**

```typescript
type ExportResultsImageProps = {
  course: {
    course_id: string;
    course_nom: string;
    categorie: string;
    type_course: string;
    date_debut: string;
    date_fin: string;
    nb_etapes: number;
    phase_id: string;
  };
  currentStage?: number;
  currentClassement?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueName?: string;  // NOUVEAU
};
```

**2. Supprimer la query `managerPoints`**

Retirer completement les lignes 120-165 qui recuperent les points des managers.

**3. Supprimer `loadingManagers` du isLoading**

Avant :
```typescript
const isLoading = loadingRiders || loadingManagers || loadingJerseys || loadingBareme;
```

Apres :
```typescript
const isLoading = loadingRiders || loadingJerseys || loadingBareme;
```

**4. Supprimer la section "Podium Managers" du template**

Retirer completement le bloc lignes 560-598 :
```typescript
{/* PODIUM MANAGERS */}
{managerPoints && managerPoints.length > 0 && (
  ...
)}
```

**5. Modifier le footer pour afficher le nom de la ligue**

Avant :
```typescript
<div style={{ textAlign: "center", color: "white", marginTop: "40px" }}>
  <p style={{ fontSize: "18px", opacity: 0.8 }}>
    Genere le {format(new Date(), "dd/MM/yyyy a HH:mm", { locale: fr })}
  </p>
</div>
```

Apres :
```typescript
<div style={{ textAlign: "center", color: "white", marginTop: "40px" }}>
  <p style={{ fontSize: "24px", fontWeight: "bold", opacity: 0.9 }}>
    {leagueName || "Mon Petit Cycliste"}
  </p>
</div>
```

**6. Mettre a jour la verification hasData**

Avant :
```typescript
const hasData = 
  (topRiders && topRiders.length > 0) ||
  (managerPoints && managerPoints.length > 0) ||
  (jerseyHolders && jerseyHolders.length > 0);
```

Apres :
```typescript
const hasData = 
  (topRiders && topRiders.length > 0) ||
  (jerseyHolders && jerseyHolders.length > 0);
```

---

### Fichier : `src/components/courses/CourseResultsDrawer.tsx`

**1. Ajouter une query pour recuperer le nom de la ligue**

```typescript
const { data: leagueInfo } = useQuery({
  queryKey: ["league-info", leagueId],
  queryFn: async () => {
    if (!leagueId) return null;
    const { data } = await supabase
      .from("leagues")
      .select("name")
      .eq("id", leagueId)
      .maybeSingle();
    return data;
  },
  enabled: !!leagueId,
  staleTime: 1000 * 60 * 30, // Cache 30 min
});
```

**2. Passer le nom de la ligue au composant ExportResultsImage**

Avant :
```typescript
<ExportResultsImage
  course={{...}}
  currentStage={selectedEtape || undefined}
  currentClassement={selectedType}
  open={exportDialogOpen}
  onOpenChange={setExportDialogOpen}
/>
```

Apres :
```typescript
<ExportResultsImage
  course={{...}}
  currentStage={selectedEtape || undefined}
  currentClassement={selectedType}
  open={exportDialogOpen}
  onOpenChange={setExportDialogOpen}
  leagueName={leagueInfo?.name}
/>
```

---

## Resume des modifications

| Fichier | Modification |
|---------|--------------|
| `ExportResultsImage.tsx` | Ajouter prop `leagueName` |
| | Supprimer query `managerPoints` |
| | Supprimer section "Podium Managers" |
| | Modifier footer avec nom de ligue |
| `CourseResultsDrawer.tsx` | Ajouter query pour nom de ligue |
| | Passer `leagueName` au composant |

---

## Resultat attendu

L'image generee affichera :
- Header avec nom de course, categorie, classement, date
- Tableau des coureurs avec positions, noms, equipes, managers, points
- Porteurs de maillots (si course par etapes)
- Footer avec uniquement le **nom de la ligue** (ex: "Ligue des Champions")

