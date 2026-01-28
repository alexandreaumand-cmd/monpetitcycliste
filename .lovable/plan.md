

# Afficher les managers et appliquer l'identite visuelle TdF

## Problemes identifies

### 1. Managers absents
La fonction RPC `results_course_top` ne retourne PAS le champ `manager_nom`. Elle retourne uniquement :
- `coureur_id`, `coureur_nom`, `coureur_equipe`, `position`, `points`, `statut`, `has_official_points`

La solution est d'utiliser l'edge function `results-course-table` qui :
- Accepte un `league_id` en parametre
- Joint la table `rosters` filtree par ligue
- Retourne `manager_nom` correctement

### 2. Identite visuelle incorrecte
Le template actuel utilise un gradient violet/bleu :
```css
background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
```

Le site utilise le theme Tour de France :
- Jaune TdF : `#FFD500` (hsl 48 100% 50%)
- Noir : `#000000`
- Gradient hero : noir vers jaune

---

## Modifications techniques

### Fichier : `src/components/admin/ExportResultsImage.tsx`

**1. Ajouter une prop `leagueId`**

```typescript
type ExportResultsImageProps = {
  // ... existing props
  leagueName?: string;
  leagueId?: string;  // NOUVEAU - necessaire pour filtrer les managers
};
```

**2. Remplacer la query `topRiders` pour utiliser l'edge function**

Utiliser `results-course-table` au lieu de la RPC `results_course_top` :

```typescript
const { data: topRiders, isLoading: loadingRiders } = useQuery({
  queryKey: ["export-top-riders", course.course_id, typeClassement, etapeNumero, scope, leagueId],
  queryFn: async () => {
    const limit = scope === "top10" ? 10 : scope === "top15" ? 15 : scope === "top20" ? 20 : 100;
    
    const { data, error } = await supabase.functions.invoke("results-course-table", {
      body: {
        course_id: course.course_id,
        type_classement: typeClassement,
        etape_numero: etapeNumero,
        league_id: leagueId || null
      }
    });
    
    if (error) throw error;
    
    // Transformer et limiter les resultats
    return (data?.rows || [])
      .filter((r: any) => r.row_position !== null)
      .slice(0, limit)
      .map((r: any) => ({
        row_position: r.row_position,
        coureur_nom: r.coureur_nom,
        equipe: r.equipe,
        manager_nom: r.manager_nom, // DISPONIBLE car edge function joint les rosters
        points: r.points_officiels || r.points_theoriques || 0
      }));
  },
  enabled: open && !loadingBareme,
});
```

**3. Appliquer l'identite visuelle TdF au template**

Remplacer le fond violet par le theme noir/jaune :

```typescript
// Fond principal - gradient noir vers jaune TdF
background: "linear-gradient(180deg, #000000 0%, #1a1a1a 60%, #FFD500 100%)"

// Font system-ui pour eviter erreurs CORS
fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
```

**4. Ajouter skipFonts pour eviter l'erreur CORS**

```typescript
const dataUrl = await toJpeg(exportRef, {
  quality: 0.95,
  pixelRatio: 2,
  width: 1080,
  height: 1920,
  cacheBust: true,
  backgroundColor: "#000000",
  skipFonts: true  // Evite l'erreur CORS sur Google Fonts
});
```

**5. Ameliorer le template visuel**

- Header : Texte jaune (#FFD500) sur fond noir
- Cards coureurs : Fond blanc avec bordure jaune pour le podium
- Podium visuel : 3 premiers avec medailles doree/argentee/bronze
- Table : Style epure avec alternance de couleurs
- Footer : Nom de la ligue en jaune sur noir

---

### Fichier : `src/components/courses/CourseResultsDrawer.tsx`

**Passer le `leagueId` au composant export**

```typescript
<ExportResultsImage
  course={{...}}
  currentStage={selectedEtape || undefined}
  currentClassement={selectedType}
  open={exportDialogOpen}
  onOpenChange={setExportDialogOpen}
  leagueName={leagueInfo?.name}
  leagueId={leagueId}  // NOUVEAU
/>
```

---

## Palette de couleurs TdF

| Element | Couleur | Code |
|---------|---------|------|
| Fond haut | Noir | `#000000` |
| Fond bas | Jaune TdF | `#FFD500` |
| Texte header | Jaune | `#FFD500` |
| Cards | Blanc | `#FFFFFF` |
| Texte body | Noir | `#000000` |
| Bordure podium 1er | Or | `#FFD500` |
| Bordure podium 2e | Argent | `#C0C0C0` |
| Bordure podium 3e | Bronze | `#CD7F32` |
| Footer | Jaune sur noir | `#FFD500` |

---

## Structure du template

```text
┌─────────────────────────────────────┐
│          FOND NOIR (#000)           │
│                                     │
│   🏆 COURSE NAME (jaune #FFD500)    │
│   Categorie • Classement • Date     │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ TABLEAU COUREURS (blanc)    │   │
│   │ Pos | Coureur | Equipe | Mgr│   │
│   │ 🥇  | Pogacar | UAE    | Bob│   │  ← Manager visible !
│   │ 🥈  | Vingeg. | VIS    | Max│   │
│   │ 🥉  | Evenep. | SOQ    | Luc│   │
│   │ 4   | ...     | ...    | ...│   │
│   └─────────────────────────────┘   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ MAILLOTS (si course etapes) │   │
│   │ 🟡 Leader  | 🟢 Points      │   │
│   │ 🔴 Montagne| ⚪ Jeune       │   │
│   └─────────────────────────────┘   │
│                                     │
│          FOND JAUNE (#FFD500)       │
│   ┌─────────────────────────────┐   │
│   │     NOM DE LA LIGUE         │   │  ← Footer branding
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## Resume des modifications

| Fichier | Modification |
|---------|--------------|
| `ExportResultsImage.tsx` | Ajouter prop `leagueId` |
| | Utiliser edge function `results-course-table` pour avoir les managers |
| | Appliquer theme TdF (noir/jaune) |
| | Ajouter `skipFonts: true` |
| `CourseResultsDrawer.tsx` | Passer `leagueId` au composant |

