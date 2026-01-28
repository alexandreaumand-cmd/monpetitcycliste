
# Correction : Classement managers et détails des porteurs de maillots

## Bugs identifiés

### Bug 1 : `phase_id` vide
Dans `CourseResultsDrawer.tsx` ligne 1207 :
```typescript
phase_id: "",  // ← Chaîne vide !
```
La requête réseau échoue avec erreur 400 : `"invalid input syntax for type uuid: \"\""`

### Bug 2 : Affichage des maillots incomplet
Dans `ExportResultsImage.tsx` lignes 577-580 :
```typescript
{jerseyHolders.map((jersey: any, idx: number) => (
  <span key={idx}>
    {jersey.icon} {jersey.points} pts  // ← Manque coureur + manager
  </span>
))}
```
L'edge function retourne bien `coureur_nom` et `manager_nom` mais ils ne sont pas affichés.

---

## Solution

### Fichier 1 : `src/components/courses/CourseResultsDrawer.tsx`

Récupérer le vrai `phase_id` depuis les données de la course.

1. Ajouter une query pour récupérer le `phase_id` depuis la table `courses` (ou le récupérer depuis `meta` si disponible)
2. Passer le vrai `phase_id` au composant `ExportResultsImage`

```typescript
// Ajouter une query pour le phase_id
const { data: courseDetails } = useQuery({
  queryKey: ["course-details", courseId],
  queryFn: async () => {
    if (!courseId) return null;
    const { data } = await supabase
      .from("courses")
      .select("phase_id")
      .eq("id", courseId)
      .maybeSingle();
    return data;
  },
  enabled: !!courseId,
});

// Puis dans le composant (ligne 1207)
phase_id: courseDetails?.phase_id || "",
```

### Fichier 2 : `src/components/admin/ExportResultsImage.tsx`

Enrichir l'affichage des maillots pour inclure le coureur et le manager.

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
        {jersey.coureurs?.nom && (
          <span style={{ marginLeft: "6px", color: "#9ca3af" }}>
            ({jersey.coureurs.nom}{jersey.managers?.nom ? ` - ${jersey.managers.nom}` : ""})
          </span>
        )}
      </span>
    ))}
  </div>
)}
```

---

## Récapitulatif des modifications

| Fichier | Ligne | Modification |
|---------|-------|--------------|
| `CourseResultsDrawer.tsx` | ~60 | Ajouter query pour récupérer `phase_id` |
| `CourseResultsDrawer.tsx` | 1207 | Passer `phase_id: courseDetails?.phase_id` |
| `ExportResultsImage.tsx` | 577-581 | Afficher coureur + manager pour chaque maillot |

## Résultat attendu

Après correction :
- **Classement Managers** : Top 10 managers avec leurs points sur la course
- **Porteurs de maillot** : `🟡 6 pts (MILAN - Manou)` au lieu de juste `🟡 6 pts`
