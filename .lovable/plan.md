

# Grille 3x2 avec Round et Ratio

## Disposition finale

```text
┌──────────┐ ┌──────────┐ ┌──────────┐
│   415    │ │    55    │ │    R3    │
│  Points  │ │   Prix   │ │  Round   │
└──────────┘ └──────────┘ └──────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐
│    2     │ │    20    │ │   7.55   │
│ Victoires│ │   Cote   │ │  Ratio   │
└──────────┘ └──────────┘ └──────────┘
```

---

## Modifications

### 1. Ajouter `round` au state et aux props

**Fichier** : `src/components/team/MyTeam.mobile.tsx`

Mettre à jour le state `selectedRider` et la fonction `openCoureurDetail` :

```typescript
const [selectedRider, setSelectedRider] = useState<{
  id: string;
  nom: string;
  equipe: string;
  prix: number;
  cote: number;
  round?: number;  // Ajouter
} | null>(null);

const openCoureurDetail = (coureur: Coureur) => {
  setSelectedRider({
    id: coureur.coureur_id,
    nom: coureur.nom,
    equipe: coureur.equipe,
    prix: coureur.prix_achat,
    cote: coureur.cote_initiale,
    round: coureur.winning_round  // Ajouter
  });
};
```

Passer la prop au composant :

```tsx
<RiderPointsDetail
  ...
  riderRound={selectedRider?.round}  // Ajouter
/>
```

### 2. Modifier RiderPointsDetail

**Fichier** : `src/components/team/RiderPointsDetail.tsx`

Ajouter la prop `riderRound` et mettre à jour la grille :

```typescript
interface RiderPointsDetailProps {
  // ... existing props
  riderRound?: number;
}
```

Nouvelle grille 3x2 :

```tsx
<div className="grid grid-cols-3 gap-2">
  {/* Ligne 1: Points | Prix | Round */}
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className="text-xl font-bold text-primary">{riderStats.totalPoints}</div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Points</div>
  </div>
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className="text-xl font-bold">{riderPrice}</div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Prix</div>
  </div>
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className="text-xl font-bold">{riderRound ? `R${riderRound}` : '-'}</div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Round</div>
  </div>
  
  {/* Ligne 2: Victoires | Cote | Ratio */}
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className="text-xl font-bold text-yellow-600">{riderStats.wins}</div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Victoires</div>
  </div>
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className="text-xl font-bold">{riderCote || '-'}</div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Cote</div>
  </div>
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className={`text-xl font-bold ${getRatioColor(riderStats.ratio)}`}>
      {riderStats.ratio}
    </div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Ratio</div>
  </div>
</div>
```

---

## Résumé

| Position | Stat | Description |
|----------|------|-------------|
| 1 | Points | Total des points marqués |
| 2 | Prix | Prix d'achat |
| 3 | Round | Tour d'enchères (R1, R2, R3...) |
| 4 | Victoires | Nombre de victoires |
| 5 | Cote | Cote initiale |
| 6 | Ratio | Points / Prix (coloré selon performance) |

---

## Fichiers impactés

| Fichier | Modification |
|---------|--------------|
| `src/components/team/RiderPointsDetail.tsx` | Nouvelle prop `riderRound`, grille 3x2 réorganisée |
| `src/components/team/MyTeam.mobile.tsx` | Passer `round` dans le state et au composant |

