

# Refactoring de l'en-tête ManagerBreakdown

## Problème actuel

L'en-tête du composant `ManagerBreakdown` est visuellement confus :
- Avatar + "Détails - Fab" + Badge "Total: 1550 pts" entassés sur une ligne
- Le mot "Détails" n'apporte aucune information
- Mauvaise hiérarchie visuelle

```text
Actuel :
┌────────────────────────────────────────────┐
│ (FA)  Détails - Fab    ┌──────────────┐   │
│                        │ Total: 1550  │   │
│                        │     pts      │   │
│                        └──────────────┘   │
└────────────────────────────────────────────┘
```

---

## Solution proposée

Réorganiser l'en-tête avec une structure plus claire :

```text
Nouveau :
┌────────────────────────────────────────────┐
│ ┌────┐                                     │
│ │ FA │   Fab                    1550 pts   │
│ └────┘                                     │
└────────────────────────────────────────────┘
```

- **Avatar plus petit** (h-10 w-10 au lieu de h-16 w-16)
- **Nom seul** sans le préfixe "Détails -"
- **Points en grand** à droite, sans le préfixe "Total:"
- **Layout horizontal** propre avec `items-center justify-between`

---

## Modifications

### 1. Mettre à jour ManagerBreakdown.tsx

**Fichier** : `src/components/rankings/ManagerBreakdown.tsx` (lignes 245-260)

Nouvelle structure du `CardHeader` :

```tsx
<CardHeader className="pb-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={managerInfo?.avatar_url || undefined} alt={managerName} />
        <AvatarFallback className="text-sm">
          {managerName.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="font-semibold text-lg">{managerName}</span>
    </div>
    <div className="text-2xl font-bold text-primary">
      {totalPoints} pts
    </div>
  </div>
</CardHeader>
```

### 2. Simplifier les traductions

Les clés `breakdown.details` et `breakdown.total` ne sont plus nécessaires pour ce composant (mais on les garde au cas où elles seraient utilisées ailleurs).

---

## Comparaison visuelle

| Aspect | Avant | Après |
|--------|-------|-------|
| Avatar | 64×64px (trop grand) | 40×40px (équilibré) |
| Titre | "Détails - Fab" | "Fab" |
| Points | Badge jaune "Total: 1550 pts" | Texte primary "1550 pts" |
| Layout | Encombré | Aéré, clair |

---

## Fichiers impactés

| Fichier | Modification |
|---------|--------------|
| `src/components/rankings/ManagerBreakdown.tsx` | Refactoring du CardHeader (lignes 245-260) |

