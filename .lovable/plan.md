

# Optimisation de l'affichage des résultats d'étape (Mobile)

## Problèmes identifiés

### 1. Section Maillots
L'affichage actuel des maillots (JerseyHoldersBar) est horizontal avec des séparateurs `|`, causant un débordement :
```
🟡 Jonathan MILAN (Lidl - Trek) • Bubu | 🟢 Jonathan MILAN (Lidl - Trek) • Bubu | ...
```

### 2. Tableau des résultats  
Le tableau a 5 colonnes (`Pos./Statut`, `Coureur`, `Équipe`, `Points`, `Manager`) qui débordent sur mobile.

---

## Solution proposée

### 1. Nouvelle section Maillots empilée verticalement

Déplacer les maillots en **bas de la section** et les afficher en **grille verticale compacte** :

```text
┌──────────────────────────────────────────┐
│  [Tableau des résultats]                 │
│  ...                                     │
├──────────────────────────────────────────┤
│  Maillots                                │
│  ┌─────────┬────────────────┬──────────┐ │
│  │ 🟡      │ J. MILAN       │ Bubu     │ │
│  │ 🟢      │ J. MILAN       │ Bubu     │ │
│  │ ⚪      │ M. FRETIN      │ Max      │ │
│  └─────────┴────────────────┴──────────┘ │
└──────────────────────────────────────────┘
```

**Fichier** : `src/components/courses/CourseResultsDrawer.tsx`

Modifier le composant `JerseyHoldersBar` (lignes 23-91) :

```tsx
const JerseyHoldersBar = ({ courseId, etapeNumero, leagueId }: { ... }) => {
  // ... existing query logic ...

  if (!holders || holders.length === 0) return null;

  return (
    <div className="bg-muted/30 rounded-lg p-3 border space-y-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Maillots
      </span>
      <div className="space-y-1.5">
        {holders.map((holder: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span className="text-lg w-6 flex-shrink-0">{holder.icon}</span>
            <span className="font-medium truncate flex-1">{holder.coureur_nom}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[80px]">
              ({holder.equipe})
            </span>
            {holder.manager_nom && (
              <span className="text-xs text-primary font-medium flex-shrink-0">
                {holder.manager_nom}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 2. Déplacer les maillots en bas de l'onglet Étapes

Dans la `TabsContent value="stages"` (ligne 705), réorganiser l'ordre :
1. Dropdown étape
2. Barème des points  
3. Tableau des résultats
4. **Maillots (en bas)**

```tsx
<TabsContent value="stages" className="space-y-4 mt-4">
  {/* 1. Dropdown étape */}
  <Select ... />

  {/* 2. Barème (collapsible) */}
  <PointsBaremeSection ... />

  {/* 3. Tableau des résultats */}
  {loading ? <Skeleton /> : (
    <div className="border rounded-lg overflow-hidden">
      <Table ... />
    </div>
  )}

  {/* 4. Maillots (déplacés en bas) */}
  {selectedEtape && (
    <JerseyHoldersBar courseId={courseId} etapeNumero={selectedEtape} leagueId={leagueId} />
  )}
</TabsContent>
```

### 3. Optimiser le tableau pour mobile

Modifier le tableau de l'onglet Étapes (lignes 740-836) pour utiliser le même format compact que l'onglet Finaux :

```tsx
<Table className="text-[11px] table-fixed w-full">
  <TableHeader>
    <TableRow>
      <TableHead className="w-7 px-1 text-center">#</TableHead>
      <TableHead className="px-1">Coureur</TableHead>
      <TableHead className="text-right px-1 w-8">Pts</TableHead>
      <TableHead className="px-1 w-16 text-right">Manager</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {displayedResults.map((row) => (
      <TableRow ...>
        <TableCell className="px-1 py-1 text-center">
          {/* Position ou médaille */}
        </TableCell>
        <TableCell className="px-1 py-1">
          <div className="flex flex-col">
            <span className="font-semibold leading-tight truncate">{row.coureur_nom}</span>
            <span className="text-[9px] text-muted-foreground truncate">{row.equipe}</span>
          </div>
        </TableCell>
        <TableCell className="text-right font-bold px-1 py-1">{points}</TableCell>
        <TableCell className="px-1 py-1 text-right">
          <span className="text-[9px] text-muted-foreground truncate block">
            {row.manager_nom}
          </span>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

## Résumé des changements

| Composant | Avant | Après |
|-----------|-------|-------|
| JerseyHoldersBar | Horizontal avec `\|` séparateurs | Grille verticale compacte |
| Position des maillots | Avant le barème | **En bas** après le tableau |
| Tableau Étapes | 5 colonnes + badges | 4 colonnes compactes, équipe sous le nom |
| Colonne Équipe | Colonne séparée | Fusionnée sous le nom du coureur |

---

## Fichiers impactés

| Fichier | Modification |
|---------|--------------|
| `src/components/courses/CourseResultsDrawer.tsx` | Refactoring JerseyHoldersBar + réorganisation TabsContent "stages" + optimisation tableau |

